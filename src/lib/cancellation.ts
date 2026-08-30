/**
 * Calcul des frais d'annulation selon la politique et la proximité
 * de l'arrivée. Fonction pure, testable. (T-016)
 *
 * T-021 : la grille par politique est désormais éditable via
 * `src/lib/settings.ts` (clé `cancellation`). La signature historique
 * `computeCancellationFee(policy, total, days)` reste inchangée et
 * utilise la grille par défaut (comportement d'origine, zéro régression).
 * Les callers qui veulent piloter par settings utilisent
 * `computeCancellationFeeWithGrid(policy, total, days, grid)`.
 */

import type { CancellationGrid } from "./settings";

export type CancellationPolicy =
  | "free"
  | "flexible"
  | "moderate"
  | "strict"
  | "non_refundable";

/**
 * Grille "hardcodée" identique au comportement historique T-016 ; sert
 * de valeur par défaut quand aucun paramètre n'est fourni.
 */
const DEFAULT_GRID: CancellationGrid = {
  free: [{ days: 0, percent: 0 }],
  flexible: [
    { days: 1, percent: 0 },
    { days: 0, percent: 100 },
  ],
  moderate: [
    { days: 5, percent: 0 },
    { days: 1, percent: 50 },
    { days: 0, percent: 100 },
  ],
  strict: [
    { days: 30, percent: 0 },
    { days: 7, percent: 50 },
    { days: 0, percent: 100 },
  ],
  non_refundable: [{ days: 0, percent: 100 }],
};

/**
 * Retourne les frais d'annulation (montant absolu), plafonnés au total.
 * Utilise la grille historique.
 */
export function computeCancellationFee(
  policy: CancellationPolicy | string | null,
  total: number,
  daysUntilCheckIn: number,
): number {
  return computeCancellationFeeWithGrid(
    policy,
    total,
    daysUntilCheckIn,
    DEFAULT_GRID,
  );
}

/**
 * Variante pilotée par grille externe (T-021). Si `grid` est null ou si
 * la politique n'existe pas dans la grille, retombe sur DEFAULT_GRID puis
 * sur la règle sécurisante "flexible".
 */
export function computeCancellationFeeWithGrid(
  policy: CancellationPolicy | string | null,
  total: number,
  daysUntilCheckIn: number,
  grid: CancellationGrid | null | undefined,
): number {
  const percent = feePercent(policy, daysUntilCheckIn, grid ?? DEFAULT_GRID);
  const fee = Math.min(total, total * (percent / 100));
  return Math.round(fee * 100) / 100;
}

function feePercent(
  policy: CancellationPolicy | string | null,
  d: number,
  grid: CancellationGrid,
): number {
  const buckets =
    policy && policy in grid
      ? grid[policy as CancellationPolicy]
      : undefined;

  if (!buckets || buckets.length === 0) {
    // policy inconnue ou null → règle sécurisante identique à v1
    return d >= 1 ? 0 : 100;
  }

  // Trie décroissant par days pour trouver le premier seuil atteint.
  const sorted = [...buckets].sort((a, b) => b.days - a.days);
  for (const bucket of sorted) {
    if (d >= bucket.days) return bucket.percent;
  }
  // Filet de sécurité : si aucun seuil n'est atteint, applique le
  // pourcentage du bucket le plus proche (days le plus petit).
  return sorted[sorted.length - 1].percent;
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
