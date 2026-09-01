import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyPromoToTotal, isPromoUsable, normalizePromoForCurrency } from "@/lib/promotions";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { isMaintenanceActive, maintenanceResponse } from "@/lib/maintenance";
import { apiError } from "@/lib/api-error";

/**
 * GET /api/promotions/apply?code=SUMMER26&amount=250 (T-016)
 * Simule l'application d'un code promo à un total. Ne modifie rien
 * en DB. La consommation réelle (`currentUses++`) se fait dans
 * POST /api/bookings.
 */
export async function GET(request: NextRequest) {
  // T-022 : mode maintenance — bloquer l'application de promo. Endpoint
  // public (pas d'auth requise) : on bloque tout le monde. Un admin
  // peut désactiver le mode depuis /dashboard/settings.
  if (await isMaintenanceActive()) {
    return maintenanceResponse();
  }

  const rl = rateLimit(`promoapply:ip:${ipFromRequest(request)}`, {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: await apiError("Trop de tentatives") },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  const amountRaw = request.nextUrl.searchParams.get("amount");
  // T-153 (audit n°25, B) : devise du total (celle de la chambre). Défaut
  // EUR = comportement historique ; les montants de la promo sont libellés
  // en EUR et convertis avant application.
  const currencyRaw = request.nextUrl.searchParams.get("currency");
  const currency = (currencyRaw || "EUR").trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, error: await apiError("Code manquant") }, { status: 400 });
  const amount = amountRaw ? parseFloat(amountRaw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: await apiError("Montant invalide") }, { status: 400 });
  }

  const [promo] = await db
    .select()
    .from(promotions)
    .where(eq(promotions.code, code))
    .limit(1);
  if (!promo) {
    return NextResponse.json({ ok: false, error: await apiError("Code inconnu") }, { status: 404 });
  }

  const check = isPromoUsable(promo);
  if (check !== true) {
    return NextResponse.json({ ok: false, error: await apiError(check) }, { status: 400 });
  }

  const result = applyPromoToTotal(normalizePromoForCurrency(promo, currency), amount);
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: await apiError(result.error) }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    promotion: {
      code: promo.code,
      name: promo.name,
      type: promo.type,
      value: promo.value,
    },
    discount: result.discount,
    finalTotal: result.finalTotal,
    // T-153 (B) : champ additif — devise dans laquelle discount/finalTotal
    // sont exprimés (défaut EUR, comportement historique conservé).
    currency,
  });
}
