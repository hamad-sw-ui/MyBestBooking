export interface LoyaltyState {
  bookingsCount: number | null;
  level: number | null;
  walletBalance: string | null;
}

/** Attribution unique au séjour terminé, pas à la simple intention d'achat. */
export function calculateLoyaltyAward(
  state: LoyaltyState,
  total: number,
  thresholds: readonly [number, number],
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
  const cashback = (state.level ?? 1) >= 3 ? Math.round(total * 0.05 * 100) / 100 : 0;
  const wallet = Math.max(0, Number(state.walletBalance ?? "0")) + cashback;
  return { bookingsCount, level, cashback, walletBalance: wallet.toFixed(2) };
}
