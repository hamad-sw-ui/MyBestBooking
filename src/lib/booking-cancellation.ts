import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { computeCancellationFeeWithGrid, daysUntil, type CancellationPolicy } from "@/lib/cancellation";
import { getSetting } from "@/lib/settings";
import { getPaymentProvider } from "@/lib/payment";
import { releaseBookingBenefits } from "@/lib/booking-benefits";
import { enqueueEmail, deliverEmail } from "@/lib/email-outbox";
import { templates } from "@/lib/mail";
import { refundLateCapturedPayment } from "@/lib/payment-events";

export class BookingCancellationError extends Error {}

export type CancellationOutcome = {
  booking: typeof bookings.$inferSelect;
  propertyName: string;
  cancellationFee: number;
};

/**
 * Persist-first cancellation. La DB garde `cancelled/refund pending` avant tout
 * appel PSP : un crash est repris par le cron au lieu de laisser un refund sans
 * trace. La clé provider universelle est `booking-refund:<bookingId>`.
 */
export async function cancelBooking(bookingId: string, reason: string): Promise<CancellationOutcome> {
  const [existing] = await db.select({ booking: bookings, property: properties })
    .from(bookings).leftJoin(properties, eq(bookings.propertyId, properties.id))
    .where(eq(bookings.id, bookingId));
  if (!existing) throw new BookingCancellationError("Réservation non trouvée");
  if (existing.booking.status !== "pending" && existing.booking.status !== "confirmed") throw new BookingCancellationError("Cette réservation ne peut plus être annulée");

  const snapshot = existing.booking.ratePlanSnapshot as { cancellationPolicy?: string; cancellationFreeDays?: number | null } | null;
  const grid = await getSetting("cancellation");
  const policy = (snapshot?.cancellationPolicy ?? existing.property?.cancellationPolicy ?? "flexible") as CancellationPolicy;
  const cancellationFee = (snapshot?.cancellationFreeDays ?? 0) > 0 && daysUntil(existing.booking.checkIn) >= (snapshot?.cancellationFreeDays ?? 0)
    ? 0
    : computeCancellationFeeWithGrid(policy, Number(existing.booking.total), daysUntil(existing.booking.checkIn), grid);
  const refundAmount = Math.max(0, Number(existing.booking.total) - cancellationFee);

  const prepared = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!locked || (locked.status !== "pending" && locked.status !== "confirmed")) throw new BookingCancellationError("Cette réservation vient déjà d'être modifiée");
    const needsRefund = locked.paymentStatus === "paid" && refundAmount > 0;
    const [updated] = await tx.update(bookings).set({
      status: "cancelled",
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancellationFee: cancellationFee.toFixed(2),
      refundAmount: refundAmount.toFixed(2),
      refundStatus: needsRefund ? "pending" : "none",
      updatedAt: new Date(),
    }).where(eq(bookings.id, bookingId)).returning();
    return updated;
  });

  // Les effets réseau sont post-commit. Un échec laisse l’état pending que le
  // cron réconcilie; l’annulation et son inventaire sont déjà cohérents.
  if (prepared.paymentStatus === "paid" && refundAmount > 0) {
    await refundLateCapturedPayment(prepared.id);
  } else if (prepared.paymentStatus === "pending" && prepared.paymentIntentId) {
    try { await (await getPaymentProvider()).cancel(prepared.paymentIntentId); } catch (error) { console.error("[booking-cancellation] cancel pending intent failed:", error); }
  }
  if (prepared.paymentStatus !== "paid") await releaseBookingBenefits(prepared.id);

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new BookingCancellationError("Réservation non trouvée");
  return { booking, propertyName: existing.property?.name ?? "", cancellationFee };
}

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
