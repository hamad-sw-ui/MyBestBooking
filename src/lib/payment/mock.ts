import { randomUUID } from "node:crypto";
import type {
  PaymentProvider,
  PaymentIntent,
  CreateIntentParams,
  WebhookEvent,
  RefundResult,
} from "./types";

/**
 * MockPaymentProvider (T-020) — utilisé quand STRIPE_SECRET_KEY est
 * absent (dev, tests, sandbox). Simule un paiement immédiatement
 * réussi. Compatible avec le comportement historique (avant Stripe).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly kind = "mock" as const;

  async create(params: CreateIntentParams): Promise<PaymentIntent> {
    return {
      id: `pi_mock_${randomUUID()}`,
      clientSecret: null,
      status: "succeeded",
      amount: params.amount,
      currency: params.currency,
    };
  }

  async cancel(_paymentIntentId: string): Promise<"succeeded"> {
    return "succeeded";
  }

  async refund(_paymentIntentId: string, amount: number): Promise<RefundResult> {
    return {
      id: `re_mock_${randomUUID()}`,
      status: "succeeded",
      amount,
    };
  }

  async verifyWebhook(payload: string): Promise<WebhookEvent | null> {
    try {
      const evt = JSON.parse(payload);
      if (!evt.data?.object?.id) return null;
      return {
        kind: "payment",
        providerEventId: evt.id ?? `${evt.type ?? "payment_intent.succeeded"}:${evt.data.object.id}:${evt.data.object.status ?? "succeeded"}`,
        type: evt.type ?? "payment_intent.succeeded",
        paymentIntentId: evt.data.object.id,
        status: evt.data.object.status ?? "succeeded",
      };
    } catch {
      return null;
    }
  }
}
