import { MockPaymentProvider } from "./mock";
import { StripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export type {
  PaymentProvider,
  PaymentIntent,
  CreateIntentParams,
  WebhookEvent,
} from "./types";
export { MockPaymentProvider, StripePaymentProvider };

let cached: PaymentProvider | null = null;

/**
 * Sélectionne le provider selon l'environnement (T-020).
 * - `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` définis → Stripe.
 * - Sinon → Mock (comportement historique : "paid" immédiat).
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const sk = process.env.STRIPE_SECRET_KEY;
  const wh = process.env.STRIPE_WEBHOOK_SECRET;
  cached = sk && wh ? new StripePaymentProvider(sk, wh) : new MockPaymentProvider();
  return cached;
}

export function _resetPaymentProvider(): void {
  cached = null;
}
