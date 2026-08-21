import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentProvider,
  PaymentIntent,
  CreateIntentParams,
  WebhookEvent,
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
    // Stripe-Signature: t=1234567,v1=hex...
    const parts = signature.split(",").reduce<Record<string, string>>((acc, p) => {
      const [k, v] = p.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const timestamp = parts.t;
    const providedSig = parts.v1;
    if (!timestamp || !providedSig) return null;

    // Vérif fenêtre 5 minutes
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - parseInt(timestamp, 10)) > 300) return null;

    const expected = createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    const a = Buffer.from(providedSig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    try {
      const evt = JSON.parse(payload);
      if (!evt.type || !evt.data?.object?.id) return null;
      return {
        type: evt.type,
        paymentIntentId: evt.data.object.id,
        status: this.normalizeStatus(evt.data.object.status ?? "pending"),
      };
    } catch {
      return null;
    }
  }
}
