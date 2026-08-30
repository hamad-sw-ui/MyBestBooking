import { MockPaymentProvider } from "./mock";
import { StripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";
import { clearProviderCredentialsCache, resolveProviderCredentials } from "@/lib/provider-credentials";

export type {
  PaymentProvider,
  PaymentIntent,
  CreateIntentParams,
  WebhookEvent,
  RefundResult,
} from "./types";
export { MockPaymentProvider, StripePaymentProvider };

/**
 * Sélectionne le provider avec override chiffré DB, puis fallback env.
 * Le mock n'est autorisé qu'en dev/test ; production exige les trois clés
 * Stripe nécessaires au serveur, webhook et navigateur.
 */
export async function getPaymentProvider(): Promise<PaymentProvider> {
  const config = await resolveProviderCredentials("stripe");
  const secretKey = config.secretKey;
  const webhookSecret = config.webhookSecret;
  const publishableKey = config.publishableKey;
  if (process.env.NODE_ENV === "production" && (!secretKey || !webhookSecret || !publishableKey)) {
    throw new Error("Le paiement production exige les clés Stripe serveur, webhook et publique");
  }
  return secretKey && webhookSecret
    ? new StripePaymentProvider(secretKey, webhookSecret)
    : new MockPaymentProvider();
}

/** Conservé pour la compatibilité des tests historiques. */
export function _resetPaymentProvider(): void {
  clearProviderCredentialsCache("stripe");
}
