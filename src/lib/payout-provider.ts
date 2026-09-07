import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * T-195 — Abstraction d'exécution des versements (Stripe Connect / SEPA).
 *
 * Miroir du pattern `src/lib/payment/index.ts` : en dev/test sans clés Stripe,
 * on utilise un `MockPayoutProvider` (aucun appel réseau, comportement de
 * succès déterministe). En production avec un compte Connect configuré, on
 * bascule vers `StripePayoutProvider`.
 *
 * ⚠️ LIMITE HONNÊTE (règle §13.5) : l'exécution STRIPE CONNECT RÉELLE (création
 * de l'account, onboarding, transfert/SEPA) nécessite des clés de test et un
 * compte Connect Stripe absents de ce sandbox. Le provider Stripe lève donc
 * une erreur explicite tant que ces clés ne sont pas fournies. La partie
 * interne (ledger, agrégation, idempotence, UI, mock) est, elle, validable.
 */

export interface PayoutAccountInput {
  provider: "stripe_connect" | "sepa";
  /** Identifiant Stripe Connect (`acct_...`) ou IBAN. Sensible — chiffré en DB. */
  reference: string;
  currency: string;
  displayLabel?: string;
}

export interface PayoutProviderResult {
  providerPayoutId: string;
  status: "succeeded" | "pending" | "failed";
}

/** Événement webhook `payout.*` provenant du fournisseur (Stripe / mock). */
export type PayoutWebhookStatus = "succeeded" | "paid" | "pending" | "failed";

export interface PayoutWebhookEvent {
  kind: "payout";
  providerEventId: string;
  type: string; // payout.paid | payout.succeeded | payout.failed | payout.canceled
  /** Identifiant du payout côté fournisseur (`po_...`). */
  payoutId: string;
  status: PayoutWebhookStatus;
}

export interface PayoutProvider {
  readonly kind: "mock" | "stripe";
  /** Enregistre / vérifie un moyen de versement. Mock : renvoie un id stable. */
  createPayoutAccount(input: PayoutAccountInput): Promise<{ accountRef: string }>;
  /** Exécute le versement d'un `net` vers le compte de l'hôte. */
  executePayout(params: {
    netAmount: number;
    currency: string;
    bookingRef?: string;
    accountRef: string;
    idempotencyKey: string;
  }): Promise<PayoutProviderResult>;
  /**
   * Vérifie et normalise un événement `payout.*`. Renvoie `null` si le payload
   * n'est pas un événement de versement (la route Stripe route alors vers le
   * handler paiement) ou si la signature est invalide.
   */
  verifyWebhook(payload: string, signature: string | null): Promise<PayoutWebhookEvent | null>;
}

/** Normalise le statut d'un payout Stripe en union maison. */
function normalizePayoutStatus(status: string | undefined): PayoutWebhookStatus {
  if (status === "paid" || status === "succeeded") return status;
  if (status === "failed" || status === "canceled") return "failed";
  return "pending";
}

/**
 * Inspection légère du type d'événement Stripe, sans rejet (allowlist). La
 * route l'utilise pour router avant la vérification de signature.
 */
export function webhookEventType(payload: string): string | null {
  try {
    const evt = JSON.parse(payload);
    return typeof evt?.type === "string" ? evt.type : null;
  } catch {
    return null;
  }
}

function parsePayoutEvent(payload: string): PayoutWebhookEvent | null {
  const type = webhookEventType(payload);
  if (!type || !type.startsWith("payout.")) return null;
  try {
    const evt = JSON.parse(payload);
    const object = evt.data?.object;
    if (!object?.id) return null;
    return {
      kind: "payout",
      providerEventId: evt.id ?? `${type}:${object.id}`,
      type,
      payoutId: object.id,
      status: normalizePayoutStatus(object.status),
    };
  } catch {
    return null;
  }
}

export class PayoutProviderError extends Error {}

/** Mock — confiné au dev/test ; succès déterministe, idempotence en mémoire. */
export class MockPayoutProvider implements PayoutProvider {
  readonly kind = "mock" as const;
  static accounts = new Map<string, string>();
  static executed = new Map<string, PayoutProviderResult>();

  async createPayoutAccount(input: PayoutAccountInput): Promise<{ accountRef: string }> {
    const ref = `po_mock_${input.provider}_${input.reference.slice(-8)}`;
    MockPayoutProvider.accounts.set(ref, input.reference);
    return { accountRef: ref };
  }

  async executePayout(params: { netAmount: number; currency: string; accountRef: string; idempotencyKey: string }): Promise<PayoutProviderResult> {
    const prior = MockPayoutProvider.executed.get(params.idempotencyKey);
    if (prior) return prior;
    const result: PayoutProviderResult = {
      providerPayoutId: `po_${Date.now()}`,
      status: "succeeded",
    };
    MockPayoutProvider.executed.set(params.idempotencyKey, result);
    return result;
  }

  async verifyWebhook(payload: string, _signature: string | null): Promise<PayoutWebhookEvent | null> {
    // Mock : pas de signature réseau ; on ne conserve que les événements `payout.*`.
    return parsePayoutEvent(payload);
  }
}

/**
 * Stripe — exige STRIPE_SECRET_KEY / connect account. Sans clés (sandbox),
 * lève une erreur explicite : on ne simule JAMAIS un transfert réel comme réussi.
 */
export class StripePayoutProvider implements PayoutProvider {
  readonly kind = "stripe" as const;
  constructor(
    private secretKey: string,
    private webhookSecret: string,
  ) {}

  async createPayoutAccount(input: PayoutAccountInput): Promise<{ accountRef: string }> {
    if (!this.secretKey || !input.reference) {
      throw new PayoutProviderError("Un compte Stripe Connect doit être configuré pour créer un compte de versement");
    }
    return { accountRef: input.reference };
  }

  async executePayout(params: { idempotencyKey: string }): Promise<PayoutProviderResult> {
    // Le transfert réel (Stripe `transfers` / `payouts`) n'est pas implémenté
    // dans ce sandbox faute de clés Connect — voir limite documentée.
    throw new PayoutProviderError(
      `Versement en attente de configuration Stripe Connect (clé: ${params.idempotencyKey})`,
    );
  }

  async verifyWebhook(payload: string, signature: string | null): Promise<PayoutWebhookEvent | null> {
    const type = webhookEventType(payload);
    if (!type || !type.startsWith("payout.")) return null;
    if (!signature || !this.webhookSecret) return null;
    // Même validation HMAC-SHA256 que le paiement (voir StripePaymentProvider).
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
    return parsePayoutEvent(payload);
  }
}

export async function getPayoutProvider(): Promise<PayoutProvider> {
  // Même règle que le paiement (T-178) : en production, sans clé, on n'exécute
  // PAS un faux versement. Un environnement de DÉMO (preview/recette sans PSP)
  // peut explicitement autoriser le mock via ALLOW_MOCK_PAYMENTS=true (opt-in
  // visible, jamais implicite) — hors prod la variable n'a aucun effet.
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const mockAllowedInProduction = process.env.ALLOW_MOCK_PAYMENTS === "true";
  if (process.env.NODE_ENV === "production") {
    if (!secretKey && !mockAllowedInProduction) {
      throw new PayoutProviderError("Le versement production exige une clé Stripe (Stripe Connect)");
    }
    return secretKey ? new StripePayoutProvider(secretKey, webhookSecret ?? "") : new MockPayoutProvider();
  }
  return new MockPayoutProvider();
}

export function _resetPayoutProvider(): void {
  MockPayoutProvider.accounts.clear();
  MockPayoutProvider.executed.clear();
}
