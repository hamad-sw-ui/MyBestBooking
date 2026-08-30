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

/** T-161 (audit n°30) — une alerte « séjour » (dates renseignées) dont le
 *  départ est déjà passé ne peut plus jamais être atteinte : elle serait
 *  re-quotée inutilement à chaque run et pouvait notifier un séjour révolu.
 *  Fonction pure (testable) ; le cron désactive ces alertes (active=false,
 *  conservateur — pas de suppression). */
export function isStayExpired(checkOut: string | null | undefined, today: string): boolean {
  return Boolean(checkOut) && checkOut! < today;
}

/** T-161 — une nouvelle alerte ne peut pas porter une arrivée dans le passé
 *  (l'annotation du séjour doit être vérifiable à l'exécution). */
export function isStayPast(checkIn: string | null | undefined, today: string): boolean {
  return Boolean(checkIn) && checkIn! < today;
}
