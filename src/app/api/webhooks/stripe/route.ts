import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getPaymentProvider } from "@/lib/payment";
import { sendBookingConfirmationIfNeeded } from "@/lib/booking-confirmation";

/**
 * Webhook Stripe idempotent : confirmation Payment Intent et réconciliation
 * refund. Aucune transition ne ressuscite une réservation annulée.
 */
export async function POST(request: NextRequest) {
  const provider = await getPaymentProvider();
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const event = await provider.verifyWebhook(payload, signature);
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  if (event.kind === "refund") {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(or(eq(bookings.refundProviderId, event.refundId), eq(bookings.paymentIntentId, event.paymentIntentId)))
      .limit(1);
    if (!booking) return NextResponse.json({ received: true, warn: "booking_not_found" });
    await db
      .update(bookings)
      .set({
        refundProviderId: event.refundId,
        refundStatus: event.status === "succeeded" ? "refunded" : event.status,
        ...(event.status === "succeeded" ? { refundedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));
    return NextResponse.json({ received: true, kind: "refund" });
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.paymentIntentId, event.paymentIntentId))
    .limit(1);
  if (!booking) return NextResponse.json({ received: true, warn: "booking_not_found" });

  if (event.status === "succeeded" && booking.paymentStatus !== "paid" && booking.status === "pending") {
    await db
      .update(bookings)
      .set({ paymentStatus: "paid", status: "confirmed", updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    try {
      await sendBookingConfirmationIfNeeded(booking.id);
    } catch (error) {
      // Le booking reste confirmé ; un retry webhook ou une future outbox peut
      // retenter l'envoi, sans faire échouer la confirmation financière.
      console.error("[stripe webhook] confirmation email failed", error);
    }
  } else if (event.status === "failed" && booking.paymentStatus !== "failed") {
    await db
      .update(bookings)
      .set({
        paymentStatus: "failed",
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: "Paiement échoué",
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));
  }

  return NextResponse.json({ received: true, kind: "payment" });
}
