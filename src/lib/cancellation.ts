/**
 * Calcul des frais d'annulation selon la politique et la proximité
 * de l'arrivée. Fonction pure, testable. (T-016)
 */

export type CancellationPolicy =
  | "free"
  | "flexible"
  | "moderate"
  | "strict"
  | "non_refundable";

/**
 * Retourne les frais d'annulation (montant absolu), plafonnés au total.
 * @param policy   Politique d'annulation de la property/rateplan
 * @param total    Montant total de la réservation
 * @param daysUntilCheckIn  Nombre de jours entiers jusqu'au check-in
 *                          (0 = aujourd'hui ou dans le passé, ≥1 sinon)
 */
export function computeCancellationFee(
  policy: CancellationPolicy | string | null,
  total: number,
  daysUntilCheckIn: number,
): number {
  const percent = feePercent(policy, daysUntilCheckIn);
  const fee = Math.min(total, total * (percent / 100));
  return Math.round(fee * 100) / 100;
}

function feePercent(
  policy: CancellationPolicy | string | null,
  d: number,
): number {
  switch (policy) {
    case "free":
      return 0;
    case "flexible":
      return d >= 1 ? 0 : 100;
    case "moderate":
      if (d >= 5) return 0;
      if (d >= 1) return 50;
      return 100;
    case "strict":
      if (d >= 30) return 0;
      if (d >= 7) return 50;
      return 100;
    case "non_refundable":
      return 100;
    default:
      // policy inconnue ou null → règle sécurisante "flexible"
      return d >= 1 ? 0 : 100;
  }
}

/**
 * Renvoie le nombre entier de jours entre `now` et `checkIn`.
 * Négatif si checkIn est dans le passé.
 */
export function daysUntil(checkIn: Date | string, now: Date = new Date()): number {
  const to = typeof checkIn === "string" ? new Date(checkIn) : checkIn;
  const ms = to.getTime() - now.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
