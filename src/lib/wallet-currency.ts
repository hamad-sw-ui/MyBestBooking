import { convertAmount, isDisplayCurrency } from "@/lib/i18n";

/**
 * T-153 (audit n°25, A) — Application des crédits wallet (libellés EUR) à un
 * total exprimé dans la devise de la chambre.
 *
 * Convention : `users.wallet_balance` est en EUR (crédits BestRewards,
 * parrainage) ; `bookings.total` est dans la devise de la chambre. La
 * déduction est convertie à l'aide des taux figés `RATES_FROM_EUR` (même
 * source que l'affichage des prix — conversion indicative documentée).
 *
 * Règles :
 *  - on ne débite JAMAIS 1:1 entre deux devises ;
 *  - `walletCreditsUsed` est stocké en EUR (montant réellement débité du
 *    wallet) pour que la restitution à l'annulation soit exacte ;
 *  - devise inconnue → erreur explicite (aucun débit silencieux).
 */

export interface WalletApplication {
  /** Déduction affichée/appliquée, dans la devise de la chambre. */
  walletUsed: number;
  /** Débit réel du wallet, en EUR (stocké et restitué tel quel). */
  walletUsedEur: number;
  /** Total restant après déduction, dans la devise de la chambre. */
  totalAfter: number;
}

export function applyWalletToTotal(
  walletEur: number,
  total: number,
  currency: string,
): WalletApplication | { error: string } {
  const cur = (currency || "EUR").toUpperCase();
  if (!isDisplayCurrency(cur)) {
    return { error: `Devise non supportée pour l'application du wallet : ${currency}` };
  }
  if (!Number.isFinite(walletEur) || walletEur <= 0) {
    return { walletUsed: 0, walletUsedEur: 0, totalAfter: total };
  }
  const walletInCurrency = convertAmount(walletEur, "EUR", cur);
  const walletUsed = Math.min(walletInCurrency, Math.max(0, total));
  const walletUsedEur = convertAmount(walletUsed, cur, "EUR");
  return {
    walletUsed: Math.round(walletUsed * 100) / 100,
    walletUsedEur: Math.round(walletUsedEur * 100) / 100,
    totalAfter: Math.round(Math.max(0, total - walletUsed) * 100) / 100,
  };
}
