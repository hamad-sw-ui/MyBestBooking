import { civilToday } from "@/lib/dates";

/**
 * T-241 (F12) — période analysée du tableau de bord.
 *
 * Constat d'audit : `/dashboard/analytics` était figé sur « 30 derniers jours
 * glissants vs 30-60 jours » codés en dur. On introduit `?from&to` (dates
 * civiles `YYYY-MM-DD`) avec **le même défaut qu'avant** : sans paramètre, la
 * période reste les 30 derniers jours et la comparaison la fenêtre de 30 jours
 * qui les précède — aucun chiffre ne bouge pour un utilisateur qui n'ouvre
 * pas le sélecteur.
 *
 * Décisions :
 *   • bornes **civiles** (indépendantes du fuseau, comme T-232) : `from` et
 *     `to` inclus ;
 *   • `to` futur ramené à aujourd'hui (une période qui n'est pas finie ne doit
 *     pas afficher de zéros trompeurs) ;
 *   • étendue bornée à 366 jours (au-delà, on avance `from` plutôt que de
 *     refuser : l'intention de l'utilisateur reste lisible) ;
 *   • période invalide (format, `from > to`) → `error` explicite que la route
 *     d'export traduit en 400, le tableau de bord retombant sur le défaut.
 */

export const ANALYTICS_DEFAULT_DAYS = 30;
export const ANALYTICS_MAX_DAYS = 366;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AnalyticsPeriod {
  /** Premier jour inclus (YYYY-MM-DD). */
  from: string;
  /** Dernier jour inclus (YYYY-MM-DD). */
  to: string;
  /** Nombre de jours de la fenêtre (from → to inclus). */
  days: number;
  /** Fenêtre précédente de même longueur (comparaison). */
  previousFrom: string;
  previousTo: string;
  /** Vrai quand aucun paramètre n'a été fourni (défaut historique). */
  isDefault: boolean;
}

/** Vraie date civile (`2026-02-30` est refusé). */
function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Décalage en jours sur une date civile (arithmétique UTC, jamais locale). */
export function shiftCivilDays(value: string, delta: number): string {
  const base = Date.parse(`${value}T00:00:00Z`) + delta * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

export function countCivilDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function parseAnalyticsPeriod(
  rawFrom?: string | null,
  rawTo?: string | null,
  today: string = civilToday("UTC"),
): { period: AnalyticsPeriod } | { error: string } {
  const from = rawFrom?.trim() || null;
  const to = rawTo?.trim() || null;

  if (!from && !to) return { period: defaultPeriod(today) };

  if ((from && !isRealDate(from)) || (to && !isRealDate(to))) {
    return { error: "Période invalide (from/to au format YYYY-MM-DD, from ≤ to)" };
  }

  let end = to ?? today;
  if (end > today) end = today;
  let start = from ?? shiftCivilDays(end, -(ANALYTICS_DEFAULT_DAYS - 1));

  if (start > end) {
    return { error: "Période invalide (from/to au format YYYY-MM-DD, from ≤ to)" };
  }
  if (countCivilDays(start, end) > ANALYTICS_MAX_DAYS) {
    start = shiftCivilDays(end, -(ANALYTICS_MAX_DAYS - 1));
  }

  return { period: buildPeriod(start, end, false) };
}

export function defaultPeriod(today: string = civilToday("UTC")): AnalyticsPeriod {
  return buildPeriod(shiftCivilDays(today, -(ANALYTICS_DEFAULT_DAYS - 1)), today, true);
}

function buildPeriod(from: string, to: string, isDefault: boolean): AnalyticsPeriod {
  const days = countCivilDays(from, to);
  const previousTo = shiftCivilDays(from, -1);
  const previousFrom = shiftCivilDays(from, -days);
  return { from, to, days, previousFrom, previousTo, isDefault };
}

/** Bornes `Date` (UTC) d'une date civile, pour les filtres de requête. */
export function civilRange(from: string, to: string): { start: Date; end: Date } {
  return {
    start: new Date(`${from}T00:00:00.000Z`),
    end: new Date(`${to}T23:59:59.999Z`),
  };
}
