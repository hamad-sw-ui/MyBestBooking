import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { computeCancellationFeeWithGrid, daysUntil, type CancellationPolicy } from "@/lib/cancellation";
import { getSetting } from "@/lib/settings";
import { getPaymentProvider } from "@/lib/payment";
import { releaseBookingBenefits } from "@/lib/booking-benefits";
import { enqueueEmail, deliverEmail } from "@/lib/email-outbox";
import { templates } from "@/lib/mail";

export class BookingCancellationError extends Error {}

export type CancellationOutcome = {
  booking: typeof bookings.$inferSelect;
  propertyName: string;
  cancellationFee: number;
};

/**
 * Commande commune à l’annulation individuelle, admin et bulk. Les effets PSP
 * sont hors transaction; les champs persistés conservent le statut repris par
 * webhook/cron en cas de réponse provider ambiguë.
 */
export async function cancelBooking(bookingId: string, reason: string): Promise<CancellationOutcome> {
  const [existing] = await db
    .select({ booking: bookings, property: properties })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .where(eq(bookings.id, bookingId));
  if (!existing) throw new BookingCancellationError("Réservation non trouvée");
  if (existing.booking.status !== "pending" && existing.booking.status !== "confirmed") {
    throw new BookingCancellationError("Cette réservation ne peut plus être annulée");
  }

  const snapshot = existing.booking.ratePlanSnapshot as { cancellationPolicy?: string; cancellationFreeDays?: number | null } | null;
  const daysBeforeCheckIn = daysUntil(existing.booking.checkIn);
  const grid = await getSetting("cancellation");
  const policy = (snapshot?.cancellationPolicy ?? existing.property?.cancellationPolicy ?? "flexible") as CancellationPolicy;
  const cancellationFee = (snapshot?.cancellationFreeDays ?? 0) > 0 && daysBeforeCheckIn >= (snapshot?.cancellationFreeDays ?? 0)
    ? 0
    : computeCancellationFeeWithGrid(policy, Number(existing.booking.total), daysBeforeCheckIn, grid);
  const refundAmount = Math.max(0, Number(existing.booking.total) - cancellationFee);

  let refundProviderId: string | null = null;
  let refundStatus: "none" | "pending" | "refunded" = "none";
  if (existing.booking.paymentStatus === "paid" && refundAmount > 0) {
    if (!existing.booking.paymentIntentId) throw new BookingCancellationError("Remboursement impossible : paiement introuvable");
    const refund = await (await getPaymentProvider()).refund(
      existing.booking.paymentIntentId,
      Math.round(refundAmount * 100),
      `booking-cancellation-refund:${existing.booking.id}`,
    );
    if (refund.status === "failed") throw new BookingCancellationError("Le remboursement a été refusé ; la réservation reste active");
    refundProviderId = refund.id;
    refundStatus = refund.status === "succeeded" ? "refunded" : "pending";
  } else if (existing.booking.paymentStatus === "pending" && existing.booking.paymentIntentId) {
    const cancellation = await (await getPaymentProvider()).cancel(existing.booking.paymentIntentId);
    if (cancellation === "failed") throw new BookingCancellationError("Le paiement en attente ne peut pas être annulé ; la réservation reste active");
  }

  const booking = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!locked) throw new BookingCancellationError("Réservation non trouvée");
    if (locked.status !== "pending" && locked.status !== "confirmed") {
      throw new BookingCancellationError("Cette réservation vient déjà d'être modifiée");
    }
    const [updated] = await tx.update(bookings).set({
      status: "cancelled",
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancellationFee: cancellationFee.toFixed(2),
      refundAmount: refundAmount.toFixed(2),
      refundStatus,
      refundProviderId,
      ...(refundStatus === "refunded" ? { refundedAt: new Date() } : {}),
      updatedAt: new Date(),
    }).where(eq(bookings.id, bookingId)).returning();
    return updated;
  });

  if (booking.paymentStatus !== "paid") await releaseBookingBenefits(booking.id);
  return { booking, propertyName: existing.property?.name ?? "", cancellationFee };
}

/** L’annulation suit aussi la même outbox que les autres effets transactionnels. */
export async function notifyBookingCancellation(outcome: CancellationOutcome): Promise<void> {
  const mail = await templates.bookingCancellation({
    firstName: outcome.booking.guestFirstName,
    bookingReference: outcome.booking.bookingReference,
    propertyName: outcome.propertyName,
    cancellationFee: outcome.cancellationFee.toFixed(2),
    currency: outcome.booking.currency ?? "EUR",
  });
  const eventKey = `booking-cancellation:${outcome.booking.id}`;
  await enqueueEmail({ eventKey, to: outcome.booking.guestEmail, ...mail });
  await deliverEmail(eventKey);
}
