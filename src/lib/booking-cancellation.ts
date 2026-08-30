import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, properties, users } from "@/db/schema";
import { computeCancellationFeeWithGrid, daysUntil, type CancellationPolicy } from "@/lib/cancellation";
import { getSetting } from "@/lib/settings";
import { getPaymentProvider } from "@/lib/payment";
import { releaseBookingBenefits } from "@/lib/booking-benefits";
import { enqueueEmail, deliverEmail } from "@/lib/email-outbox";
import { templates } from "@/lib/mail";
import { refundLateCapturedPayment } from "@/lib/payment-events";

export class BookingCancellationError extends Error {}

/** T-156 (audit n°29) : qui annule — le voyageur paie la politique ; un
 *  hébergeur/admin annule sans frais (remboursement intégral). */
export type CancellationActor = "customer" | "host" | "admin" | "system";

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
export async function cancelBooking(
  bookingId: string,
  reason: string,
  actor: CancellationActor = "customer",
): Promise<CancellationOutcome> {
  // T-156 : une annulation par l'hébergeur ou l'administrateur n'est JAMAIS
  // facturée au voyageur — le motif est forcé par le serveur (le libellé
  // « Annulation demandée par le voyageur » en dur depuis l'UI hôte ne doit
  // pas être persisté). Seule l'annulation du voyageur applique la grille.
  const byOperator = actor === "host" || actor === "admin";
  const effectiveReason = byOperator
    ? actor === "host"
      ? "Annulée par l'hébergeur"
      : "Annulée par l'administrateur"
    : reason;
  const [existing] = await db.select({ booking: bookings, property: properties })
    .from(bookings).leftJoin(properties, eq(bookings.propertyId, properties.id))
    .where(eq(bookings.id, bookingId));
  if (!existing) throw new BookingCancellationError("Réservation non trouvée");
  if (existing.booking.status !== "pending" && existing.booking.status !== "confirmed") throw new BookingCancellationError("Cette réservation ne peut plus être annulée");

  const snapshot = existing.booking.ratePlanSnapshot as { cancellationPolicy?: string; cancellationFreeDays?: number | null } | null;
  const grid = await getSetting("cancellation");
  const policy = (snapshot?.cancellationPolicy ?? existing.property?.cancellationPolicy ?? "flexible") as CancellationPolicy;
  const cancellationFee = byOperator
    ? 0
    : (snapshot?.cancellationFreeDays ?? 0) > 0 && daysUntil(existing.booking.checkIn) >= (snapshot?.cancellationFreeDays ?? 0)
      ? 0
      : computeCancellationFeeWithGrid(policy, Number(existing.booking.total), daysUntil(existing.booking.checkIn), grid);
  const refundAmount = Math.max(0, Number(existing.booking.total) - cancellationFee);

  const prepared = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!locked || (locked.status !== "pending" && locked.status !== "confirmed")) throw new BookingCancellationError("Cette réservation vient déjà d'être modifiée");
    const needsRefund = locked.paymentStatus === "paid" && refundAmount > 0;
    const [updated] = await tx.update(bookings).set({
      status: "cancelled",
      cancellationReason: effectiveReason,
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
  // T-129 : la part carte d'une réservation payée est remboursée par le PSP
  // ci-dessus (idempotent via refundStatus), mais les crédits wallet et l'usage
  // d'un code promo n'ont pas d'équivalent PSP : on les restitue dans tous les
  // cas d'annulation. releaseBookingBenefits est idempotent (garde
  // benefitsReleasedAt, transaction FOR UPDATE) et ne touche pas au PSP :
  // aucun double remboursement possible.
  await releaseBookingBenefits(prepared.id);

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new BookingCancellationError("Réservation non trouvée");
  return { booking, propertyName: existing.property?.name ?? "", cancellationFee };
}

export async function notifyBookingCancellation(
  outcome: CancellationOutcome,
  actor: CancellationActor = "customer",
): Promise<void> {
  // Langue du voyageur destinataire.
  const [guest] = outcome.booking.userId
    ? await db.select({ language: users.language }).from(users).where(eq(users.id, outcome.booking.userId))
    : [];
  // T-156 : annulation par l'hébergeur/admin → e-mail plateforme
  // « remboursement intégral » (jamais « frais appliqués ») ; annulation
  // voyageur → template admin historique (inchangé).
  const mail = actor === "host" || actor === "admin"
    ? await templates.bookingCancelledByOperator({
        firstName: outcome.booking.guestFirstName,
        bookingReference: outcome.booking.bookingReference,
        propertyName: outcome.propertyName,
        refundAmount: outcome.booking.refundAmount ?? outcome.booking.total,
        currency: outcome.booking.currency ?? "EUR",
        actor,
        language: guest?.language ?? null,
      })
    : await templates.bookingCancellation({
        firstName: outcome.booking.guestFirstName,
        bookingReference: outcome.booking.bookingReference,
        propertyName: outcome.propertyName,
        cancellationFee: outcome.cancellationFee.toFixed(2),
        currency: outcome.booking.currency ?? "EUR",
        language: guest?.language ?? null,
      });
  const eventKey = `booking-cancellation:${outcome.booking.id}`;
  await enqueueEmail({ eventKey, to: outcome.booking.guestEmail, ...mail });
  await deliverEmail(eventKey);

  // T-150 : l'hôte est aussi notifié (langue de l'hôte), via l'outbox
  // (eventKey déterministe). Best-effort : un échec ne casse jamais
  // l'annulation déjà persistée ni l'e-mail du voyageur.
  try {
    const [property] = await db
      .select({ hostId: properties.hostId })
      .from(properties)
      .where(eq(properties.id, outcome.booking.propertyId))
      .limit(1);
    if (property?.hostId) {
      const [host] = await db
        .select({ email: users.email, firstName: users.firstName, language: users.language })
        .from(users)
        .where(eq(users.id, property.hostId))
        .limit(1);
      if (host?.email) {
        const hostMail = await templates.bookingHostCancellation({
          hostFirstName: host.firstName,
          bookingReference: outcome.booking.bookingReference,
          propertyName: outcome.propertyName,
          guestName: `${outcome.booking.guestFirstName} ${outcome.booking.guestLastName}`.trim(),
          checkIn: String(outcome.booking.checkIn),
          checkOut: String(outcome.booking.checkOut),
          reason: outcome.booking.cancellationReason ?? "Annulation demandée",
          language: host.language ?? null,
        });
        const hostKey = `booking-cancellation:${outcome.booking.id}:host`;
        await enqueueEmail({ eventKey: hostKey, to: host.email, ...hostMail });
        await deliverEmail(hostKey);
      }
    }
  } catch (error) {
    console.error("[booking-cancellation] host notification mail failed:", error);
  }
}
