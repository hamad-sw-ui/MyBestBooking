import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyPromoToTotal, isPromoUsable } from "@/lib/promotions";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { isMaintenanceActive, maintenanceResponse } from "@/lib/maintenance";

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
      { ok: false, error: "Trop de tentatives" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  const amountRaw = request.nextUrl.searchParams.get("amount");
  if (!code) return NextResponse.json({ ok: false, error: "Code manquant" }, { status: 400 });
  const amount = amountRaw ? parseFloat(amountRaw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Montant invalide" }, { status: 400 });
  }

  const [promo] = await db
    .select()
    .from(promotions)
    .where(eq(promotions.code, code))
    .limit(1);
  if (!promo) {
    return NextResponse.json({ ok: false, error: "Code inconnu" }, { status: 404 });
  }

  const check = isPromoUsable(promo);
  if (check !== true) {
    return NextResponse.json({ ok: false, error: check }, { status: 400 });
  }

  const result = applyPromoToTotal(promo, amount);
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
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
  });
}
