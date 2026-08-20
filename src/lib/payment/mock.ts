import { randomUUID } from "node:crypto";
import type {
  PaymentProvider,
  PaymentIntent,
  CreateIntentParams,
  WebhookEvent,
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

  async verifyWebhook(payload: string): Promise<WebhookEvent | null> {
    try {
      const evt = JSON.parse(payload);
      if (!evt.data?.object?.id) return null;
      return {
        type: evt.type ?? "payment_intent.succeeded",
        paymentIntentId: evt.data.object.id,
        status: evt.data.object.status ?? "succeeded",
      };
    } catch {
      return null;
    }
  }
}
