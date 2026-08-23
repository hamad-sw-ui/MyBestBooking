import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentProvider,
  PaymentIntent,
  CreateIntentParams,
  WebhookEvent,
  RefundResult,
} from "./types";

/**
 * StripePaymentProvider (T-020).
 * Utilise l'API HTTPS Stripe directement, sans SDK (~1.5 MB économisés).
 * Signature Webhook validée manuellement.
 *
 * Activé quand STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET sont
 * définis.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly kind = "stripe" as const;

  constructor(
    private secretKey: string,
    private webhookSecret: string,
  ) {}

  async create(params: CreateIntentParams): Promise<PaymentIntent> {
    // Stripe API accepte application/x-www-form-urlencoded
    const body = new URLSearchParams({
      amount: String(params.amount),
      currency: params.currency.toLowerCase(),
      "metadata[booking_ref]": params.bookingReference,
      "receipt_email": params.guestEmail,
      "automatic_payment_methods[enabled]": "true",
    });

    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(params.idempotencyKey ? { "Idempotency-Key": params.idempotencyKey } : {}),
      },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Stripe create failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      id: string;
      client_secret: string;
      status: string;
    };
    return {
      id: data.id,
      clientSecret: data.client_secret,
      status: this.normalizeStatus(data.status),
      amount: params.amount,
      currency: params.currency,
    };
  }

  async retrieve(paymentIntentId: string): Promise<PaymentIntent | null> {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Stripe retrieve failed: HTTP ${res.status}`);
    const data = (await res.json()) as { id: string; client_secret?: string; status?: string; amount?: number; currency?: string };
    return {
      id: data.id,
      clientSecret: data.client_secret ?? null,
      status: this.normalizeStatus(data.status ?? "pending"),
      amount: data.amount ?? 0,
      currency: data.currency ?? "EUR",
    };
  }

  async cancel(paymentIntentId: string): Promise<"succeeded" | "pending" | "failed"> {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    if (!res.ok) return "failed";
    const data = (await res.json()) as { status?: string };
    return data.status === "canceled" ? "succeeded" : "pending";
  }

  async refund(paymentIntentId: string, amount: number, idempotencyKey?: string): Promise<RefundResult> {
    const body = new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(amount),
    });
    const res = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Stripe refund failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { id: string; status: string; amount: number };
    return {
      id: data.id,
      status: data.status === "succeeded" ? "succeeded" : data.status === "failed" ? "failed" : "pending",
      amount: data.amount,
    };
  }

  private normalizeStatus(s: string): PaymentIntent["status"] {
    if (s === "succeeded" || s === "requires_payment_method") return s;
    if (s === "canceled") return "failed";
    if (s === "processing" || s === "requires_action" || s === "requires_confirmation") return "pending";
    return "pending";
  }

  async verifyWebhook(
    payload: string,
    signature: string | null,
  ): Promise<WebhookEvent | null> {
    if (!signature) return null;
    // Stripe peut signer avec plusieurs v1 pendant une rotation de secret.
    const pieces = signature.split(",").map((part) => part.trim().split("=", 2));
    const timestamp = pieces.find(([key]) => key === "t")?.[1];
    const signatures = pieces.filter(([key]) => key === "v1").map(([, value]) => value).filter(Boolean) as string[];
    if (!timestamp || !signatures.length) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - parseInt(timestamp, 10)) > 300) return null;

    const expected = createHmac("sha256", this.webhookSecret).update(`${timestamp}.${payload}`).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const valid = signatures.some((provided) => {
      const candidate = Buffer.from(provided, "hex");
      return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
    });
    if (!valid) return null;

    try {
      const evt = JSON.parse(payload);
      if (!evt.type || !evt.data?.object?.id) return null;
      const object = evt.data.object as { id: string; status?: string; payment_intent?: string };
      if (["refund.created", "refund.updated"].includes(evt.type)) {
        if (!object.payment_intent) return null;
        return {
          kind: "refund",
          providerEventId: evt.id ?? `${evt.type}:${object.id}:${object.status ?? "pending"}`,
          type: evt.type,
          refundId: object.id,
          paymentIntentId: object.payment_intent,
          status: object.status === "succeeded" ? "succeeded" : object.status === "failed" || object.status === "canceled" ? "failed" : "pending",
        };
      }
      if (!["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled", "payment_intent.processing"].includes(evt.type)) return null;
      return {
        kind: "payment",
        providerEventId: evt.id ?? `${evt.type}:${object.id}:${object.status ?? "pending"}`,
        type: evt.type,
        paymentIntentId: object.id,
        status: this.normalizeStatus(object.status ?? "pending"),
      };
    } catch {
      return null;
    }
  }

}
