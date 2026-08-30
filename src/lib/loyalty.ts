import { convertAmount, isDisplayCurrency } from "@/lib/i18n";

export interface LoyaltyState {
  bookingsCount: number | null;
  level: number | null;
  walletBalance: string | null;
}

/**
 * Attribution unique au séjour terminé, pas à la simple intention d'achat.
 *
 * T-153 (audit n°25, C) : paramètre optionnel `currency` (devise du
 * `total`). Le wallet étant libellé EUR, un total non-EUR est converti en
 * EUR avant le calcul du cashback — sinon un séjour USD générerait un
 * cashback « USD » crédité en EUR. Défaut : EUR (comportement historique).
 */
export function calculateLoyaltyAward(
  state: LoyaltyState,
  total: number,
  thresholds: readonly [number, number],
  currency?: string,
): {
  bookingsCount: number;
  level: number;
  cashback: number;
  walletBalance: string;
} {
  const bookingsCount = (state.bookingsCount ?? 0) + 1;
  const level = bookingsCount >= thresholds[1] ? 3 : bookingsCount >= thresholds[0] ? 2 : 1;
  // Le cashback est acquis par les membres déjà Ambassador au moment où
  // le séjour est finalisé ; atteindre le niveau sur ce séjour s'applique
  // aux séjours suivants, ce qui évite un effet rétroactif ambigu.
  const cur = (currency ?? "EUR").toUpperCase();
  const totalEur = isDisplayCurrency(cur) && cur !== "EUR"
    ? convertAmount(total, cur, "EUR")
    : total;
  const cashback = (state.level ?? 1) >= 3 ? Math.round(totalEur * 0.05 * 100) / 100 : 0;
  const wallet = Math.max(0, Number(state.walletBalance ?? "0")) + cashback;
  return { bookingsCount, level, cashback, walletBalance: wallet.toFixed(2) };
}
