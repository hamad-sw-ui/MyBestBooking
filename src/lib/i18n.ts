/**
 * T-029 — Utilitaires d'internationalisation légers.
 *
 * V1 : anglais uniquement (via `descriptionEn` etc.), français par
 * défaut. Bibliothèque `next-intl` évitée pour ne pas alourdir le
 * bundle ; sera introduite si les besoins dépassent les libellés
 * transactionnels.
 */

export type Locale = "fr" | "en" | "ar";

export function pickLocalized<T extends Record<string, unknown>>(
  row: T,
  fields: Record<string, string>,
  locale: Locale | string | null | undefined,
): T {
  const wanted = (locale ?? "fr").toString().slice(0, 2).toLowerCase() as Locale;
  if (wanted === "fr") return row;
  const out = { ...row } as Record<string, unknown>;
  for (const [base, translated] of Object.entries(fields)) {
    if (wanted === "en" && translated in row && (row as Record<string, unknown>)[translated]) {
      out[base] = (row as Record<string, unknown>)[translated];
    }
  }
  return out as T;
}

/**
 * Table de conversion figée pour V1. Utilisée par
 * `formatMoney(amount, currency, targetCurrency)`. Ces taux
 * proviennent d'un snapshot à la date de release et sont documentés
 * comme approximatifs — pas un service de FX temps réel.
 */
export const RATES_FROM_EUR: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  CHF: 0.94,
  MAD: 10.9,
  XAF: 655.957,
};

export function convertAmount(
  amount: number,
  from: string,
  to: string,
): number {
  const rFrom = RATES_FROM_EUR[from.toUpperCase()] ?? 1;
  const rTo = RATES_FROM_EUR[to.toUpperCase()] ?? 1;
  const inEur = amount / rFrom;
  return Math.round(inEur * rTo * 100) / 100;
}

/**
 * T-133 (A1) — Traduit une borne de filtre de prix saisie dans la devise
 * d'affichage (ex. FCFA) vers la devise de stockage/facturation (EUR, celle
 * des chambres). Utilisée par la recherche pour que « prix max 50 000 FCFA »
 * filtre sur les ~76 € correspondants. Sans devise, en EUR, ou devise
 * inconnue : renvoie la valeur telle quelle (comportement historique, sans
 * régression). Taux figés indicatifs (RATES_FROM_EUR).
 */
export function priceBoundToStorage(value: number, displayCurrency?: string | null): number {
  if (!displayCurrency) return value;
  const cur = displayCurrency.toString().toUpperCase();
  if (cur === "EUR" || !(cur in RATES_FROM_EUR)) return value;
  return convertAmount(value, cur, "EUR");
}

/**
 * Format monétaire localisé (Intl.NumberFormat).
 */
export function formatMoney(
  amount: number,
  currency: string = "EUR",
  locale: string = "fr-FR",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
