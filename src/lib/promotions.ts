/**
 * Utilitaires purs pour appliquer un code promo à un total.
 * Testable sans DB. Utilisé par GET /api/promotions/apply et
 * POST /api/bookings. (T-016)
 */

export interface PromotionLike {
  code: string;
  type: string; // "percentage" | "fixed_amount" | "free_night"
  value: string; // decimal(10,2) → string
  minBookingAmount: string | null;
  maxDiscount: string | null;
  validFrom: Date;
  validUntil: Date;
  maxUses: number | null;
  currentUses: number | null;
  isActive: boolean | null;
}

export interface AppliedPromo {
  discount: number;
  finalTotal: number;
}

export function isPromoUsable(p: PromotionLike, now: Date = new Date()): true | string {
  if (!p.isActive) return "Code inactif";
  const from = new Date(p.validFrom);
  const until = new Date(p.validUntil);
  if (now < from) return "Code pas encore actif";
  if (now > until) return "Code expiré";
  if (p.maxUses !== null && (p.currentUses ?? 0) >= p.maxUses) {
    return "Code épuisé";
  }
  return true;
}

export function applyPromoToTotal(
  p: PromotionLike,
  total: number,
): AppliedPromo | { error: string } {
  const usable = isPromoUsable(p);
  if (usable !== true) return { error: usable };

  const min = parseFloat(p.minBookingAmount ?? "0");
  if (total < min) {
    return { error: `Réservation minimum ${min.toFixed(2)}` };
  }

  const value = parseFloat(p.value);
  let discount = 0;
  if (p.type === "percentage") {
    discount = total * (value / 100);
  } else if (p.type === "fixed_amount") {
    discount = value;
  } else if (p.type === "free_night") {
    // Approximation : traité comme fixed_amount = value (le calcul
    // "1 nuit gratuite" nécessite le prix par nuit, hors périmètre).
    discount = value;
  }
  const max = p.maxDiscount != null ? parseFloat(p.maxDiscount) : null;
  if (max !== null && discount > max) discount = max;
  discount = Math.min(discount, total);
  discount = Math.round(discount * 100) / 100;

  return {
    discount,
    finalTotal: Math.round((total - discount) * 100) / 100,
  };
}
