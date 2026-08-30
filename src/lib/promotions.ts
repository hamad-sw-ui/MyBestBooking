/**
 * Utilitaires purs pour appliquer un code promo à un total.
 * Testable sans DB. Utilisé par GET /api/promotions/apply et
 * POST /api/bookings. (T-016)
 *
 * T-153 (audit n°25, B) : la valeur et les seuils d'une promo sont libellés
 * en EUR (convention admin) ; `normalizePromoForCurrency` les convertit vers
 * la devise de la chambre avant application, pour ne jamais appliquer un
 * montant EUR 1:1 à un total USD/GBP.
 */
import { convertAmount, isDisplayCurrency } from "@/lib/i18n";

export interface PromotionLike {
  code: string;
  type: string; // "percentage" | "fixed_amount" (legacy free_night refusée)
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
  } else {
    // Les données legacy free_night restent lisibles mais ne peuvent pas être
    // appliquées approximativement comme un montant fixe.
    return { error: "Ce type de promotion nécessite un calcul par nuit et n'est pas encore disponible" };
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

/**
 * T-153 (audit n°25, B) — Copie de la promo dont les montants LIBELLÉS EN
 * EUR (`value` si `fixed_amount`, `minBookingAmount`, `maxDiscount`) sont
 * convertis dans la devise de la chambre (`currency`).
 *
 * - `percentage` : inchangé (une remise en % est indépendante de la devise) ;
 * - devise inconnue/absente → copie inchangée (comportement historique,
 *   aucune conversion approximative) ;
 * - résultat : `applyPromoToTotal(normalizePromoForCurrency(promo, c),
 *   total)` retourne un discount directement dans la devise de la chambre.
 */
export function normalizePromoForCurrency(
  p: PromotionLike,
  currency: string,
): PromotionLike {
  const cur = (currency || "EUR").toUpperCase();
  if (!isDisplayCurrency(cur) || cur === "EUR") return { ...p };
  const toCur = (value: string | null | undefined): string | null => {
    if (value == null) return null;
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return value;
    return convertAmount(n, "EUR", cur).toFixed(2);
  };
  return {
    ...p,
    // Le montant fixe est en EUR ; un pourcentage reste un pourcentage.
    value: p.type === "fixed_amount" ? toCur(p.value) ?? p.value : p.value,
    minBookingAmount: toCur(p.minBookingAmount) ?? p.minBookingAmount,
    maxDiscount: toCur(p.maxDiscount) ?? p.maxDiscount,
  };
}
