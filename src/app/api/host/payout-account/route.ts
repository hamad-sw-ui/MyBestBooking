import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { frenchZodMessage, zodErrorResponse } from "@/lib/http";
import { isSupportedCurrency } from "@/lib/i18n";
import { rateLimit } from "@/lib/rate-limit";
import {
  listPayoutAccounts,
  upsertPayoutAccount,
  type PayoutAccountProvider,
} from "@/lib/payout-service";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { ProviderCredentialsError } from "@/lib/provider-credentials";
import { platformPayoutsEnabled } from "@/lib/platform-flags";

/**
 * /api/host/payout-account — moyen de versement d'un hôte/admin (T-195, C2/G1).
 *
 * GET  — liste expurgée (jamais le secret : ni IBAN ni account_id).
 * POST — crée / met à jour un compte (provider + reference chiffrée AES-GCM).
 *
 * Rôle `host` et `admin` uniquement. Non-régressif : ajout pur, aucun contrat
 * existant modifié. Sans `CREDENTIALS_ENCRYPTION_KEY`, POST renvoie 503 (on ne
 * stocke jamais un IBAN en clair).
 */

const providerSchema = z.enum(["stripe_connect", "sepa"]);

// IBAN (format prudent : lettres/2 puis ~25 alphanumériques) ou account_id Stripe.
const referenceSchema = z
  .string()
  .min(8)
  .max(255)
  .regex(/^[A-Za-z0-9]{8,255}$/, "Référence invalide (IBAN ou identifiant Stripe)");

const bodySchema = z.object({
  provider: providerSchema,
  reference: referenceSchema,
  currency: z.string().trim().toUpperCase().refine(isSupportedCurrency, "Devise non supportée"),
  displayLabel: z.string().max(120).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    if (user.role !== "host" && user.role !== "admin") {
      return NextResponse.json({ error: await apiError("Accès hébergeur ou admin requis") }, { status: 403 });
    }
    const isAdmin = user.role === "admin";
    const accounts = await listPayoutAccounts(user.id, isAdmin);
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[host/payout-account] GET", error);
    return NextResponse.json({ error: await apiError("Impossible de lire les comptes de versement") }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    if (user.role !== "host" && user.role !== "admin") {
      return NextResponse.json({ error: await apiError("Accès hébergeur ou admin requis") }, { status: 403 });
    }
    if (!platformPayoutsEnabled()) {
      return NextResponse.json(
        {
          error: await apiError("Configuration de versement désactivée tant que les paiements plateforme sont hors service"),
          code: "PLATFORM_PAYOUTS_DISABLED",
          platformPayoutsDisabled: true,
        },
        { status: 410 },
      );
    }

    const rl = rateLimit(`host:payout-account:${user.id}`, { limit: 20, windowMs: 60_000 });
    if (!rl.ok) return NextResponse.json({ error: await apiError("Trop de modifications, réessayez plus tard") }, { status: 429 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }
    const { provider, reference, currency, displayLabel } = parsed.data;
    const providerTyped = provider as PayoutAccountProvider;

    // SEPA : validation IBAN plus stricte (2 lettres + 2 chiffres + alphanum).
    if (providerTyped === "sepa" && !/^[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}$/.test(reference)) {
      return NextResponse.json({ error: await apiError("IBAN invalide (format international attendu)") }, { status: 400 });
    }

    const result = await upsertPayoutAccount(user.id, {
      provider: providerTyped,
      reference,
      currency,
      displayLabel,
    });

    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: result.created ? AUDIT_ACTIONS.payoutAccountCreate : AUDIT_ACTIONS.payoutAccountUpdate,
      entityType: "payout_account",
      entityId: result.account.id,
      // Jamais la référence ni le secret : uniquement la métadonnée publique.
      metadata: { provider, currency, isDefault: result.account.isDefault },
    });

    return NextResponse.json({ created: result.created, account: result.account });
  } catch (error) {
    if (error instanceof ProviderCredentialsError) {
      return NextResponse.json({ error: await apiError(error.message) }, { status: 503 });
    }
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("[host/payout-account] POST", error);
    return NextResponse.json({ error: await apiError("Impossible d'enregistrer le compte de versement") }, { status: 502 });
  }
}
