import { convertAmount, formatMoney, isDisplayCurrency, RATES_FROM_EUR } from "@/lib/i18n";

/**
 * T-152 (finding C) — Agrégation de montants PAR DEVISE pour les totaux
 * d'affichage (analytics, billing).
 *
 * Règle : on n'additionne JAMAIS deux devises dans un même total affiché.
 * Les montants transactionnels (paiement, remboursement, wallet) ne passent
 * jamais ici : ils restent dans la devise de la chambre (voir T-132).
 */

export interface CurrencyAmount {
  currency: string | null | undefined;
  amount: number;
}

/** Somme par devise (clé normalisée en majuscules, défaut EUR). */
export function sumByCurrency(items: CurrencyAmount[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    // Un montant non fini (NaN/Infinity) ne doit jamais polluer un total.
    if (!Number.isFinite(item.amount)) continue;
    const key = (item.currency || "EUR").toUpperCase();
    map[key] = (map[key] ?? 0) + item.amount;
  }
  return map;
}

/**
 * Devise dominante d'une répartition (pour une série graphique) :
 * la plus grande somme ; en cas d'égalité, EUR prioritaire (affichage
 * stable et aligné avec le cas réel actuel).
 */
export function topCurrency(map: Record<string, number>): string | null {
  const entries = Object.entries(map).filter(([, value]) => value !== 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length > 1 && entries[0][1] === entries[1][1]) {
    const eur = entries.find(([currency]) => currency === "EUR");
    return eur ? eur[0] : entries[0][0];
  }
  return entries[0][0];
}

/** Devises présentes (somme non nulle), ordre stable (EUR puis alphabétique). */
export function currenciesOf(map: Record<string, number>): string[] {
  const found = Object.keys(map).filter((currency) => Number.isFinite(map[currency]) && map[currency] !== 0);
  found.sort((a, b) => {
    if (a === "EUR") return -1;
    if (b === "EUR") return 1;
    return a.localeCompare(b);
  });
  return found;
}

/** Vrai si plusieurs devises ont un montant non nul. */
export function hasMixedCurrencies(map: Record<string, number>): boolean {
  return currenciesOf(map).length > 1;
}

/** Devises non convertibles : elles doivent être visibles, jamais ignorées. */
export function unconvertibleCurrencies(map: Record<string, number>): string[] {
  return currenciesOf(map).filter((currency) => !isDisplayCurrency(currency));
}

export function hasUnconvertibleCurrencies(map: Record<string, number>): boolean {
  return unconvertibleCurrencies(map).length > 0;
}

/** Valeur nominale comparable dans une devise cible, sans arrondi d'affichage. */
export function comparableAmount(amount: number, currency: string, targetCurrency: string): number | null {
  if (!Number.isFinite(amount)) return null;
  const source = currency.toUpperCase();
  const target = targetCurrency.toUpperCase();
  if (!isDisplayCurrency(source) || !isDisplayCurrency(target)) return null;
  if (source === target) return amount;
  const sourceRate = RATES_FROM_EUR[source];
  const targetRate = RATES_FROM_EUR[target];
  return (amount / sourceRate) * targetRate;
}

/** Devise dominante après conversion dans une base commune. */
export function topCurrencyByValue(map: Record<string, number>, targetCurrency: string): string | null {
  const target = targetCurrency.toUpperCase();
  const entries = currenciesOf(map)
    .map((currency) => ({ currency, value: comparableAmount(map[currency], currency, target) }))
    .filter((entry): entry is { currency: string; value: number } => entry.value !== null);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.value - a.value || a.currency.localeCompare(b.currency));
  return entries[0].currency;
}

/**
 * Affichage d'une répartition : une devise → `formatPrice` seul
 * (identique au rendu historique EUR) ; plusieurs devises → liste jointe
 * par « + », chaque groupe formaté dans sa propre devise. Aucune somme
 * inter-devises n'est jamais affichée.
 */
export function formatCurrencyBreakdown(map: Record<string, number>, locale: string = "fr-FR"): string {
  const currencies = currenciesOf(map);
  if (currencies.length === 0) return formatMoney(0, "EUR", locale);
  return currencies.map((currency) => formatMoney(map[currency], currency, locale)).join(" + ");
}

/**
 * T-195 — Agrégat converti vers une devise d'affichage (AFFICHAGE UNIQUEMENT).
 *
 * Règle inchangée (T-132) : on ne convertit JAMAIS un montant transactionnel
 * (paiement, remboursement, portefeuille). Cette fonction ne sert qu'à donner
 * une lecture unifiée indicative du chiffre d'affaires total dans le dashboard,
 * SANS masquer la répartition native par devise (voir `formatCurrencyBreakdown`).
 * Les taux sont les taux figés `RATES_FROM_EUR` (même source que l'affichage
 * public — conversion indicative documentée).
 */
export function sumByCurrencyConverted(
  items: CurrencyAmount[],
  targetCurrency: string,
): { total: number; hasMixed: boolean } {
  const map = sumByCurrency(items);
  const cur = (targetCurrency || "EUR").toUpperCase();
  const currencies = currenciesOf(map);
  if (!isDisplayCurrency(cur)) {
    return { total: 0, hasMixed: currencies.length > 1 };
  }
  let total = 0;
  let seen: Record<string, boolean> = {};
  for (const [currency, amount] of Object.entries(map)) {
    if (!Number.isFinite(amount) || amount === 0) continue;
    seen[currency] = true;
    if (currency === cur) {
      total += amount;
    } else if (isDisplayCurrency(currency) && isDisplayCurrency(cur)) {
      total += convertAmount(amount, currency, cur);
    }
  }
  return {
    total: Math.round(total * 100) / 100,
    hasMixed: Object.keys(seen).length > 1,
  };
}

/**
 * T-195 — Rendu d'un total converti en devise d'affichage. Si plusieurs devises
 * sont mélangées, on affiche le total converti AU-DESSUS d'un fragment natif
 * `formatCurrencyBreakdown` pour ne jamais masquer la réalité multi-devises.
 */
export function formatCurrencyConverted(
  map: Record<string, number>,
  targetCurrency: string,
  locale: string = "fr-FR",
): string {
  const cur = (targetCurrency || "EUR").toUpperCase();
  const currencies = currenciesOf(map);
  if (currencies.length === 0) return formatMoney(0, cur, locale);
  // Une devise inconnue ne doit jamais disparaître d'un KPI. On montre alors
  // la répartition native, avec le code reçu, plutôt qu'un faux total cible.
  if (!isDisplayCurrency(cur) || hasUnconvertibleCurrencies(map)) {
    return formatCurrencyBreakdown(map, locale);
  }
  let total = 0;
  for (const [currency, amount] of Object.entries(map)) {
    if (!Number.isFinite(amount) || amount === 0) continue;
    total += currency === cur ? amount : convertAmount(amount, currency, cur);
  }
  return formatMoney(Math.round(total * 100) / 100, cur, locale);
}
