import { NextRequest, NextResponse } from "next/server";
import { generatePendingPayoutsForPeriod, previousMonthRange } from "@/lib/payout-service";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { platformPayoutsEnabled } from "@/lib/platform-flags";

export const dynamic = "force-dynamic";

/** Autorisation cron : CRON_SECRET en production ; ouvert en dev/test. */
function authorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Tâche cron idempotente (G3) — génère un payout `pending` par (hôte, devise)
 * pour le mois précédent (surchargeable via `?periodStart&periodEnd` pour les
 * tests), pour tous les hôtes ayant des bookings payés.
 * Ne déclenche PAS de transfert ; le provider est exécuté à la demande ou
 * confirmé par le webhook `payout.*`.
 *
 * Le runner local (`scripts/cron-runner.mjs`) ET le cron Vercel (`vercel.json`)
 * déclenchent la route en **GET** (voir `price-alerts`). Le `POST` est conservé
 * pour la compatibilité des tests.
 */
export async function GET(request: NextRequest) {
  return runPayoutCron(request);
}

export async function POST(request: NextRequest) {
  return runPayoutCron(request);
}

async function runPayoutCron(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
  }
  if (!platformPayoutsEnabled()) {
    return NextResponse.json(
      {
        error: await apiError("Cron versements désactivé : les paiements plateforme ne sont pas actifs"),
        code: "PLATFORM_PAYOUTS_DISABLED",
        platformPayoutsDisabled: true,
      },
      { status: 410 },
    );
  }
  try {
    const url = new URL(request.url);
    const qStart = url.searchParams.get("periodStart");
    const qEnd = url.searchParams.get("periodEnd");
    const hasOverride = Boolean(qStart && qEnd);
    if (hasOverride && (!/^\d{4}-\d{2}-\d{2}$/.test(qStart!) || !/^\d{4}-\d{2}-\d{2}$/.test(qEnd!) || qStart! > qEnd!)) {
      return NextResponse.json({ error: await apiError("Période invalide (YYYY-MM-DD)") }, { status: 400 });
    }
    const { start, end } = hasOverride ? { start: qStart!, end: qEnd! } : previousMonthRange();
    const result = await generatePendingPayoutsForPeriod(start, end);
    await recordAudit({
      actorId: null,
      action: AUDIT_ACTIONS.payoutCron,
      entityType: "payout",
      metadata: { periodStart: start, periodEnd: end, ...result },
    });
    return NextResponse.json({ received: true, period: { start, end }, ...result });
  } catch (error) {
    console.error("[cron/payouts]", error);
    return NextResponse.json({ error: await apiError("Impossible de générer les versements") }, { status: 500 });
  }
}
