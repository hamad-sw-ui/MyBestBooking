import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { isUuid } from "@/lib/http";
import {
  listProjectedPayouts,
  listPersistedPayouts,
  createPayoutsForPeriod,
  markPayoutPaid,
  markPayoutProcessing,
  getDefaultPayoutAccount,
  openPayoutAccountReference,
} from "@/lib/payout-service";
import { getPayoutProvider } from "@/lib/payout-provider";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { platformPayoutsEnabled } from "@/lib/platform-flags";

/**
 * /api/host/payouts (T-195)
 *
 * GET  — versements projetés (6 derniers mois) + ledger persistant (hôte ou tous si admin).
 * POST — « demander un versement » : crée un payout idempotent pour une période,
 *        puis tente l'exécution via le PayoutProvider (mock en dev, Stripe si clés).
 *
 * Lisible/actionnable par `host` et `admin` uniquement. Le paiement client est
 * INTÉGRALEMENT inchangé (aucune modification du tunnel).
 */
const bodySchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // P6 : devise optionnelle — si fournie, n'exécute que le payout de cette
  // devise (ligne de projection = une devise). Sans `currency`, comportement
  // historique (toutes les devises de la période).
  currency: z.string().length(3).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    if (user.role !== "host" && user.role !== "admin") {
      return NextResponse.json({ error: await apiError("Accès hébergeur ou admin requis") }, { status: 403 });
    }
    const isAdmin = user.role === "admin";
    const projected = await listProjectedPayouts(user.id, isAdmin);
    const persisted = await listPersistedPayouts(user.id, isAdmin);
    return NextResponse.json({ projected, persisted });
  } catch (error) {
    console.error("[host/payouts] GET", error);
    return NextResponse.json({ error: await apiError("Impossible de lire les versements") }, { status: 502 });
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
          error: await apiError("Versements plateforme désactivés : les règlements sont gérés hors MyBestBooking"),
          code: "PLATFORM_PAYOUTS_DISABLED",
          platformPayoutsDisabled: true,
        },
        { status: 410 },
      );
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: await apiError("Période invalide (YYYY-MM-DD)") }, { status: 400 });
    }
    const { periodStart, periodEnd, currency } = parsed.data;
    if (periodStart > periodEnd) {
      return NextResponse.json({ error: await apiError("periodStart doit être ≤ periodEnd") }, { status: 400 });
    }
    const isAdmin = user.role === "admin";
    const result = await createPayoutsForPeriod(user.id, isAdmin, periodStart, periodEnd);
    // P6 : si une devise est demandée, ne traiter que le payout correspondant
    // (une ligne de projection = une devise). Sans `currency`, on traite toute
    // la période (comportement historique).
    const targetPayouts = currency
      ? result.payouts.filter((p) => p.currency.toUpperCase() === currency.toUpperCase())
      : result.payouts;
    if (targetPayouts.length === 0) {
      // Le payout de la devise demandée est peut-être déjà/existant ou inexistant ;
      // on répond 404 proprement si rien à exécuter sur cette période/devise.
      const hasAny = result.payouts.some((p) => p.currency.toUpperCase() === currency?.toUpperCase());
      if (!hasAny) {
        return NextResponse.json({ error: await apiError("Aucun montant éligible sur cette période") }, { status: 404 });
      }
    }

    // G1 : consulte le compte de versement par défaut pour l'exécution. En
    // l'absence de compte, on ne bloque PAS (comportement mock/dev préservé,
    // non-régression) mais on renseigne `hasAccount` pour l'UI.
    const account = await getDefaultPayoutAccount(user.id);
    // P2 : avec un compte, on déscelle la VRAIE référence (IBAN / acct_...) pour
    // l'exécution ; sans compte, repli mock/dev sur un libellé hôte.
    const accountRef = account ? await openPayoutAccountReference(account.id) : `host:${user.id}`;

    // Exécution du versement via le provider, PAR payout (un par devise).
    const provider = await getPayoutProvider();
    const payouts = [] as Array<{ id: string; status: string; currency: string }>;
    // P2 — garde-fou devise : un payout dont la devise diffère de celle du
    // compte par défaut n'est PAS exécuté (règle « ne jamais mélanger les
    // devises »). Il reste `pending` et est signalé dans `skipped[]`.
    const skipped = [] as Array<{ id: string; currency: string; accountCurrency: string | null; reason: string }>;
    let anyFailed = false;
    for (const payout of targetPayouts) {
      // P3 : un admin crée des payouts pour TOUS les hôtes mais ne doit PAS
      // exécuter (marquer payé) le versement d'un autre hôte. Seul l'hôte
      // propriétaire exécute son propre versement ; sinon il reste `pending`
      // et est signalé dans `skipped[]`.
      if (payout.hostId !== user.id) {
        skipped.push({
          id: payout.id,
          currency: payout.currency,
          accountCurrency: account?.currency ?? null,
          reason: "Exécution réservée à l'hôte propriétaire",
        });
        await recordAudit({
          actorId: user.id,
          actorEmail: user.email,
          action: AUDIT_ACTIONS.payoutRequest,
          entityType: "payout",
          entityId: payout.id,
          metadata: { periodStart, periodEnd, currency: payout.currency, skipped: true, reason: "non-propriétaire" },
        });
        continue;
      }
      const accountCurrency = account?.currency ?? null;
      if (account && accountCurrency && payout.currency.toUpperCase() !== accountCurrency.toUpperCase()) {
        skipped.push({
          id: payout.id,
          currency: payout.currency,
          accountCurrency,
          reason: "Devise du versement incompatible avec le compte de versement",
        });
        await recordAudit({
          actorId: user.id,
          actorEmail: user.email,
          action: AUDIT_ACTIONS.payoutRequest,
          entityType: "payout",
          entityId: payout.id,
          metadata: { periodStart, periodEnd, currency: payout.currency, skipped: true, accountCurrency },
        });
        continue;
      }
      const providerResult = await provider.executePayout({
        netAmount: Number(payout.netAmount),
        currency: payout.currency,
        accountRef,
        idempotencyKey: payout.idempotencyKey,
      });
      if (providerResult.status === "succeeded") {
        await markPayoutPaid(payout.id, providerResult.providerPayoutId);
        payouts.push({ id: payout.id, status: "paid", currency: payout.currency });
      } else if (providerResult.status === "failed") {
        anyFailed = true;
        payouts.push({ id: payout.id, status: "failed", currency: payout.currency });
      } else {
        // pending / in_transit : persiste le providerPayoutId pour qu'un
        // webhook `payout.paid` puisse le confirmer plus tard.
        await markPayoutProcessing(payout.id, providerResult.providerPayoutId);
        payouts.push({ id: payout.id, status: "pending", currency: payout.currency });
      }
      await recordAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.payoutRequest,
        entityType: "payout",
        entityId: payout.id,
        metadata: { periodStart, periodEnd, currency: payout.currency },
      });
    }

    const statusCode = anyFailed ? 502 : 200;
    return NextResponse.json({ created: result.created, hasAccount: Boolean(account), payouts, skipped }, { status: statusCode });
  } catch (error) {
    console.error("[host/payouts] POST", error);
    return NextResponse.json({ error: await apiError("Impossible de demander le versement") }, { status: 502 });
  }
}
