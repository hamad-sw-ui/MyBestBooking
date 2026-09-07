import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment";
import { processPendingPaymentEvents, recordPaymentEvent } from "@/lib/payment-events";
import { getPayoutProvider, webhookEventType } from "@/lib/payout-provider";
import { markPayoutPaidByProviderId, markPayoutFailedByProviderId } from "@/lib/payout-service";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";

/**
 * Webhook Stripe unifié (T-020 / T-195).
 *
 * Routage par type d'événement :
 *  - `payout.*` (payout.paid / payout.succeeded / payout.failed / payout.canceled)
 *    → confirmation du versement dans le ledger `payouts` (idempotent).
 *  - `payment_intent.*` / `refund.*` → flux historique (inbox paiement, idempotent).
 *
 * Inbox idempotente : même si Stripe envoie l'événement avant le commit du
 * booking, il est conservé puis traité par le cron ou un événement suivant.
 */
export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const type = webhookEventType(payload);

  // Versements : route dédiée, signature vérifiée par le PayoutProvider.
  if (type?.startsWith("payout.")) {
    const payoutProvider = await getPayoutProvider();
    const event = await payoutProvider.verifyWebhook(payload, signature);
    if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    if (event.status === "paid" || event.status === "succeeded") {
      const confirmed = await markPayoutPaidByProviderId(event.payoutId);
      // P4 : journalise la confirmation d'un versement (idempotent).
      if (confirmed) {
        await recordAudit({
          actorId: null,
          action: AUDIT_ACTIONS.payoutPaid,
          entityType: "payout",
          entityId: event.payoutId,
          metadata: { providerEventId: event.providerEventId, type: event.type },
        });
      }
      return NextResponse.json({ received: true, kind: "payout", status: "paid", confirmed });
    }
    if (event.status === "failed") {
      const marked = await markPayoutFailedByProviderId(event.payoutId);
      // P4 : journalise l'échec d'un versement.
      if (marked) {
        await recordAudit({
          actorId: null,
          action: AUDIT_ACTIONS.payoutFailed,
          entityType: "payout",
          entityId: event.payoutId,
          metadata: { providerEventId: event.providerEventId, type: event.type },
        });
      }
      return NextResponse.json({ received: true, kind: "payout", status: "failed", marked });
    }
    // pending / in_transit : aucune action (le payout reste `processing`).
    return NextResponse.json({ received: true, kind: "payout", status: "pending" });
  }

  // Paiements / remboursements : flux historique.
  const provider = await getPaymentProvider();
  const event = await provider.verifyWebhook(payload, signature);
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  await recordPaymentEvent(event);
  const processed = await processPendingPaymentEvents();
  return NextResponse.json({ received: true, processed });
}
