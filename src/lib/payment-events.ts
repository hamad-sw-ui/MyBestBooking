import { eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { bookings, paymentEventInbox } from "@/db/schema";
import type { WebhookEvent } from "@/lib/payment";
import { sendBookingConfirmationIfNeeded } from "@/lib/booking-confirmation";

export async function recordPaymentEvent(event: WebhookEvent): Promise<void> {
  await db.insert(paymentEventInbox).values({
    providerEventId: event.providerEventId,
    type: event.type,
    paymentIntentId: event.paymentIntentId,
    refundId: event.kind === "refund" ? event.refundId : null,
    status: event.status,
  }).onConflictDoNothing({ target: paymentEventInbox.providerEventId });
}

/** Traite les événements dont le booking est désormais disponible. */
export async function processPendingPaymentEvents(limit = 50): Promise<number> {
  const events = await db.select().from(paymentEventInbox).where(isNull(paymentEventInbox.processedAt)).limit(limit);
  let processed = 0;
  for (const event of events) {
    const [booking] = await db.select().from(bookings).where(
      event.refundId ? or(eq(bookings.refundProviderId, event.refundId), eq(bookings.paymentIntentId, event.paymentIntentId)) : eq(bookings.paymentIntentId, event.paymentIntentId),
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
    } else if (event.status === "failed" && booking.paymentStatus !== "failed") {
      await db.update(bookings).set({ paymentStatus: "failed", status: "cancelled", cancelledAt: new Date(), cancellationReason: "Paiement échoué", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
    }
    await db.update(paymentEventInbox).set({ processedAt: new Date() }).where(eq(paymentEventInbox.id, event.id));
    processed += 1;
  }
  return processed;
}
