import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPaymentProvider } from "@/lib/payment";

/**
 * POST /api/webhooks/stripe (T-020)
 * Reçoit les events Stripe et met à jour le booking correspondant.
 * Signature vérifiée dans provider.verifyWebhook. Idempotent : un
 * même paymentIntentId `succeeded` reçu 2× ne change rien la 2e fois.
 */
export async function POST(request: NextRequest) {
  const provider = getPaymentProvider();
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  const event = await provider.verifyWebhook(payload, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.paymentIntentId, event.paymentIntentId))
    .limit(1);

  if (!booking) {
    // Le webhook peut arriver avant le commit du booking (rare) ou
    // référencer un paymentIntent d'un autre projet. On acquitte 200
    // pour éviter les retries infinis Stripe.
    return NextResponse.json({ received: true, warn: "booking_not_found" });
  }

  if (event.status === "succeeded" && booking.paymentStatus !== "paid") {
    await db
      .update(bookings)
      .set({
        paymentStatus: "paid",
        status: "confirmed",
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));
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

  return NextResponse.json({ received: true });
}
