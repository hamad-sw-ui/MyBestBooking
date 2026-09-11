/**
 * T-175 — Détection pure des paramètres de recherche ignorés/incohérents.
 *
 * Constat d'exécution : la page `/recherche` absorbait silencieusement des
 * filtres saisis mais inutilisables (bornes de prix inversées → 0 résultat
 * « inexplicable », dates inversées ou passées → clause dispo ignorée,
 * `guests=abc` → filtre voyageurs abandonné). L'utilisateur croyait chercher
 * sur ces critères alors que le moteur les avait écartés.
 *
 * Cette fonction NE CHANGE PAS le filtrage : elle signale seulement, pour
 * affichage d'un bandeau d'avertissement, les cas où la valeur saisie n'a
 * pas été (ou ne peut pas être) prise en compte. Aucune io, tests unitaires.
 */

import { priceBoundToStorage } from "@/lib/i18n";
import type { UiStringKey } from "@/lib/ui-strings";
import { civilToday } from "@/lib/dates";

export type SearchWarning =
  /** checkIn/checkOut présents mais mal formés, incomplets ou inversés. */
  | "datesIgnored"
  /** Séjour entièrement dans le passé (non réservable). */
  | "pastDates"
  /** minPrice > maxPrice (après conversion en devise de stockage). */
  | "priceInverted"
  /** guests présent mais pas un entier > 0. */
  | "guestsIgnored"
  /** T-249 : `sort` présent mais hors liste blanche → tri par défaut (rating). */
  | "sortIgnored";

export interface SearchWarnParams {
  checkIn?: string;
  checkOut?: string;
  minPrice?: string;
  maxPrice?: string;
  displayCurrency?: string;
  guests?: string;
  /** T-249 : tri demandé (le moteur applique `rating` si la valeur est inconnue). */
  sort?: string;
}

/** Valeurs de tri réellement traitées par `GET /api/properties` (route.ts:206-216). */
const SORT_VALUES = ["rating", "price_asc", "price_desc", "popularity"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Date du jour au format YYYY-MM-DD (UTC — référence stable pour les tests). */
function todayIso(): string {
  return civilToday("UTC");
}

/** Warning → clé de dictionnaire (mapping explicite, type-safe). */
export const SEARCH_WARNING_KEY: Record<SearchWarning, UiStringKey> = {
  datesIgnored: "search.warn.datesIgnored",
  pastDates: "search.warn.pastDates",
  priceInverted: "search.warn.priceInverted",
  guestsIgnored: "search.warn.guestsIgnored",
  sortIgnored: "search.warn.sortIgnored",
};

export function searchFilterWarnings(params: SearchWarnParams): SearchWarning[] {
  const warnings: SearchWarning[] = [];

  const ci = params.checkIn?.trim();
  const co = params.checkOut?.trim();
  if (ci || co) {
    const wellFormed =
      Boolean(ci) && DATE_RE.test(ci!) && Boolean(co) && DATE_RE.test(co!);
    if (!wellFormed || co! <= ci!) {
      warnings.push("datesIgnored");
    } else if (ci! < todayIso()) {
      warnings.push("pastDates");
    }
  }

  const min = params.minPrice?.trim();
  const max = params.maxPrice?.trim();
  if (min && max) {
    const nMin = Number(min);
    const nMax = Number(max);
    if (Number.isFinite(nMin) && Number.isFinite(nMax) && nMin >= 0 && nMax >= 0) {
      // Comparaison dans la devise de STOCKAGE (celle du filtre SQL), comme
      // le moteur : sinon un taux écrasé (ex. XAF) pourrait tromper.
      if (priceBoundToStorage(nMin, params.displayCurrency) > priceBoundToStorage(nMax, params.displayCurrency)) {
        warnings.push("priceInverted");
      }
    }
  }

  const guests = params.guests?.trim();
  if (guests) {
    const n = Number(guests);
    if (!Number.isInteger(n) || n <= 0) warnings.push("guestsIgnored");
  }

  // T-249 : le moteur retombe sur `rating` quand `sort` n'est pas reconnu ;
  // l'utilisateur doit savoir que son tri n'a pas été appliqué.
  const sort = params.sort?.trim();
  if (sort && !(SORT_VALUES as readonly string[]).includes(sort)) {
    warnings.push("sortIgnored");
  }

  return warnings;
}
