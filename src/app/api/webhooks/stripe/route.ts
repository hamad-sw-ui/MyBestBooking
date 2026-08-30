import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment";
import { processPendingPaymentEvents, recordPaymentEvent } from "@/lib/payment-events";

/**
 * Inbox idempotente : même si Stripe envoie l'événement avant le commit du
 * booking, il est conservé puis traité par le cron ou un événement suivant.
 */
export async function POST(request: NextRequest) {
  const provider = await getPaymentProvider();
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const event = await provider.verifyWebhook(payload, signature);
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  await recordPaymentEvent(event);
  const processed = await processPendingPaymentEvents();
  return NextResponse.json({ received: true, processed });
}
