import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { bookings, paymentEventInbox } from "@/db/schema";
import type { WebhookEvent } from "@/lib/payment";
import { getPaymentProvider } from "@/lib/payment";
import { sendBookingConfirmationIfNeeded } from "@/lib/booking-confirmation";
import { releaseBookingBenefits } from "@/lib/booking-benefits";

export async function recordPaymentEvent(event: WebhookEvent): Promise<void> {
  await db.insert(paymentEventInbox).values({
    providerEventId: event.providerEventId,
    type: event.type,
    paymentIntentId: event.paymentIntentId,
    refundId: event.kind === "refund" ? event.refundId : null,
    status: event.status,
  }).onConflictDoNothing({ target: paymentEventInbox.providerEventId });
}

/**
 * Compensation d’un paiement capturé après l’annulation. La transition DB est
 * très courte; l’appel PSP est délibérément hors transaction. La même clé est
 * utilisable après une perte de réponse réseau sans dupliquer le remboursement.
 */
export async function refundLateCapturedPayment(bookingId: string): Promise<boolean> {
  const candidate = await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!booking || booking.status !== "cancelled" || !booking.paymentIntentId || booking.refundStatus === "refunded") return null;
    const previouslyQuoted = Number(booking.refundAmount ?? "0");
    const amount = previouslyQuoted > 0
      ? previouslyQuoted
      : Math.max(0, Number(booking.total) - Number(booking.cancellationFee ?? "0"));
    if (amount <= 0) {
      await tx.update(bookings).set({ paymentStatus: "paid", refundStatus: "refunded", refundedAt: new Date(), updatedAt: new Date() }).where(eq(bookings.id, booking.id));
      return null;
    }
    await tx.update(bookings).set({
      // Le paiement a réellement été capturé, même si le séjour reste annulé.
      paymentStatus: "paid",
      refundAmount: amount.toFixed(2),
      refundStatus: "pending",
      updatedAt: new Date(),
    }).where(eq(bookings.id, booking.id));
    return { id: booking.id, paymentIntentId: booking.paymentIntentId, amount };
  });
  if (!candidate) return false;

  try {
    const refund = await (await getPaymentProvider()).refund(
      candidate.paymentIntentId,
      Math.round(candidate.amount * 100),
      `booking-refund:${candidate.id}`,
    );
    // Ne jamais écraser une confirmation webhook de remboursement arrivée
    // pendant l’appel réseau.
    await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, candidate.id)).for("update");
      if (!booking || booking.refundStatus === "refunded") return;
      await tx.update(bookings).set({
        refundProviderId: refund.id,
        // "failed" reste retryable : la requête peut avoir été acceptée par
        // le PSP mais sa réponse perdue. La clé provider est donc réutilisée.
        refundStatus: refund.status === "succeeded" ? "refunded" : "pending",
        ...(refund.status === "succeeded" ? { refundedAt: new Date() } : {}),
        updatedAt: new Date(),
      }).where(eq(bookings.id, candidate.id));
    });
    return refund.status !== "failed";
  } catch (error) {
    console.error("[payment-events] late payment refund failed:", error);
    // L’état pending est repris par le cron; aucun débit n’est masqué comme
    // remboursé sur un simple échec réseau.
    return false;
  }
}

/** Retente de façon bornée les compensations déjà réclamées par l’inbox. */
export async function reconcileLateCapturedPaymentRefunds(limit = 20): Promise<number> {
  const candidates = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.status, "cancelled"),
      eq(bookings.paymentStatus, "paid"),
      eq(bookings.refundStatus, "pending"),
      isNotNull(bookings.paymentIntentId),
    ))
    .limit(limit);
  let attempted = 0;
  for (const candidate of candidates) {
    if (await refundLateCapturedPayment(candidate.id)) attempted += 1;
  }
  return attempted;
}

/** Traite les événements dont le booking est désormais disponible. */
export async function processPendingPaymentEvents(limit = 50): Promise<number> {
  const events = await db.select().from(paymentEventInbox).where(isNull(paymentEventInbox.processedAt)).limit(limit);
  let processed = 0;
  for (const event of events) {
    const [booking] = await db.select().from(bookings).where(
      event.refundId
        ? or(eq(bookings.refundProviderId, event.refundId), eq(bookings.paymentIntentId, event.paymentIntentId))
        : eq(bookings.paymentIntentId, event.paymentIntentId),
    ).limit(1);
    if (!booking) continue;

    if (event.refundId) {
      await db.update(bookings).set({
        refundProviderId: event.refundId,
        refundStatus: event.status === "succeeded" ? "refunded" : event.status,
        ...(event.status === "succeeded" ? { refundedAt: new Date() } : {}),
        updatedAt: new Date(),
      }).where(eq(bookings.id, booking.id));
    } else if (event.status === "succeeded" && booking.status === "pending" && booking.paymentStatus !== "paid") {
      await db.update(bookings).set({ paymentStatus: "paid", status: "confirmed", paymentExpiresAt: null, updatedAt: new Date() }).where(eq(bookings.id, booking.id));
      await sendBookingConfirmationIfNeeded(booking.id);
    } else if (event.status === "succeeded" && booking.status === "cancelled") {
      // Le séjour annulé ne revient jamais à confirmed : son paiement est
      // compensé, y compris si l’expiration a déjà libéré le stock/promo.
      await refundLateCapturedPayment(booking.id);
    } else if (event.status === "failed" && booking.status === "pending" && booking.paymentStatus !== "failed") {
      await db.update(bookings).set({ paymentStatus: "failed", status: "cancelled", cancelledAt: new Date(), cancellationReason: "Paiement échoué", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
      await releaseBookingBenefits(booking.id);
    }
    await db.update(paymentEventInbox).set({ processedAt: new Date() }).where(eq(paymentEventInbox.id, event.id));
    processed += 1;
  }
  return processed;
}
