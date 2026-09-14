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

/** Devises acceptées pour les montants persistés et les paiements. */
export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "MAD", "XAF"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Catalogue unique des devises que l'interface sait afficher. Il est partagé
 * par le profil, les réglages admin, les sélecteurs public/dashboard, l'API
 * de préférences et la validation du profil. Les réglages admin peuvent
 * désactiver une option, mais aucune surface ne doit inventer un autre code.
 */
export const DISPLAY_CURRENCIES = SUPPORTED_CURRENCIES;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
export const UI_CURRENCY_OPTIONS = DISPLAY_CURRENCIES;

/** Métadonnées du snapshot indicatif utilisé par l'affichage uniquement. */
export const FX_SNAPSHOT = {
  source: "MyBestBooking indicative snapshot",
  asOf: "2026-09-14",
  kind: "indicative" as const,
};

/** Type-guard : une devise d'affichage est-elle connue/convertible ? */
export function isDisplayCurrency(cur: string | null | undefined): cur is DisplayCurrency {
  return typeof cur === "string" && (DISPLAY_CURRENCIES as readonly string[]).includes(cur.trim().toUpperCase());
}

/** Valide une devise avant de la persister ou de l'envoyer au PSP. */
export function isSupportedCurrency(cur: string | null | undefined): cur is DisplayCurrency {
  return typeof cur === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(cur.trim().toUpperCase());
}

/**
 * Normalise une devise d'affichage vers une clé connue (majusculisée)
 * ou le repli `fallback` si elle est absente/inconnue. Évite qu'une
 * valeur aberrante (« ZZZ ») ne remonte jusqu'à l'affichage des prix.
 */
export function normalizeDisplayCurrency(
  cur: string | null | undefined,
  fallback: DisplayCurrency = "XAF",
): DisplayCurrency {
  const up = typeof cur === "string" ? cur.trim().toUpperCase() : "";
  return isDisplayCurrency(up) ? up : fallback;
}

export function convertAmount(
  amount: number,
  from: string,
  to: string,
): number {
  const source = from.trim().toUpperCase();
  const target = to.trim().toUpperCase();
  // Unknown codes are not allowed to masquerade as EUR. Callers that need a
  // rendered value must keep the native breakdown and expose the code.
  if (!(source in RATES_FROM_EUR) || !(target in RATES_FROM_EUR)) return amount;
  const inEur = amount / RATES_FROM_EUR[source];
  return Math.round(inEur * RATES_FROM_EUR[target] * 100) / 100;
}

/** Taux indicatif source → cible, ou null si la paire est inconnue. */
export function indicativeRate(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!isDisplayCurrency(from) || !isDisplayCurrency(to)) return null;
  const source = from.trim().toUpperCase();
  const target = to.trim().toUpperCase();
  return RATES_FROM_EUR[target] / RATES_FROM_EUR[source];
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
 * T-154e (audit n°26, P3-10) — devises zéro-décimales (Stripe : le montant
 * est exprimé en unités majeures, pas en centimes). Liste officielle Stripe
 * (BIF, CLP, DJF, GNF, JPY, KMF, KRW, MGA, PYG, RWF, VND, VUV, XAF, XOF,
 * XPF). Avant : `amount * 100` inconditionnel → un Pipeline XAF 100 000
 * aurait été débité 10 000 000 XAF (×100).
 */
export const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF",
  "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function isZeroDecimalCurrency(currency: string | null | undefined): boolean {
  return ZERO_DECIMAL_CURRENCIES.has((currency ?? "").toUpperCase());
}

/** Montant en unités mineures pour le PSP (×100 sauf zéro-décimal ×1). */
export function toMinorUnits(amount: number, currency: string): number {
  return isZeroDecimalCurrency(currency)
    ? Math.round(amount)
    : Math.round(amount * 100);
}

/**
 * Format monétaire localisé (Intl.NumberFormat). Devises zéro-décimales :
 * 0 décimale (Intl natif) au lieu de 2 forcées — « 50.00 XAF » → « 50 XAF ».
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
      maximumFractionDigits: isZeroDecimalCurrency(currency) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(isZeroDecimalCurrency(currency) ? 0 : 2)} ${currency}`;
  }
}
