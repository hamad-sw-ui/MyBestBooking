import { randomUUID } from "node:crypto";
import type {
  PaymentProvider,
  PaymentIntent,
  CreateIntentParams,
  WebhookEvent,
  RefundResult,
} from "./types";

/**
 * MockPaymentProvider — utilisé uniquement sans configuration Stripe en dev/test.
 * Les maps statiques reproduisent l'idempotence fournisseur lors d'une reprise.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly kind = "mock" as const;
  private static intentsByKey = new Map<string, PaymentIntent>();
  private static refundsByKey = new Map<string, RefundResult>();

  async create(params: CreateIntentParams): Promise<PaymentIntent> {
    if (params.idempotencyKey) {
      const previous = MockPaymentProvider.intentsByKey.get(params.idempotencyKey);
      if (previous) return previous;
    }
    const intent: PaymentIntent = {
      id: `pi_mock_${randomUUID()}`,
      clientSecret: null,
      status: "succeeded",
      amount: params.amount,
      currency: params.currency,
    };
    if (params.idempotencyKey) MockPaymentProvider.intentsByKey.set(params.idempotencyKey, intent);
    return intent;
  }

  async cancel(_paymentIntentId: string): Promise<"succeeded"> {
    return "succeeded";
  }

  async refund(_paymentIntentId: string, amount: number, idempotencyKey?: string): Promise<RefundResult> {
    if (idempotencyKey) {
      const previous = MockPaymentProvider.refundsByKey.get(idempotencyKey);
      if (previous) return previous;
    }
    const refund: RefundResult = {
      id: `re_mock_${randomUUID()}`,
      status: "succeeded",
      amount,
    };
    if (idempotencyKey) MockPaymentProvider.refundsByKey.set(idempotencyKey, refund);
    return refund;
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
