/** Ne notifie que lorsqu'un seuil est atteint pour la première fois ou baisse encore. */
export function shouldNotifyPriceAlert(input: {
  currentPrice: number;
  maxPrice: number;
  lastNotifiedPrice: string | null;
}): boolean {
  if (!Number.isFinite(input.currentPrice) || input.currentPrice <= 0) return false;
  if (input.currentPrice > input.maxPrice) return false;
  const previous = input.lastNotifiedPrice == null ? null : Number(input.lastNotifiedPrice);
  return previous == null || !Number.isFinite(previous) || input.currentPrice < previous;
}
