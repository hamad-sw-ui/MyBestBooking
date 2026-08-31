import { formatPrice } from "@/lib/utils";

/**
 * T-152 (finding C) — Agrégation de montants PAR DEVISE pour les totaux
 * d'affichage (analytics, billing).
 *
 * Règle : on n'additionne JAMAIS deux devises dans un même total affiché.
 * Les montants transactionnels (paiement, remboursement, wallet) ne passent
 * jamais ici : ils restent dans la devise de la chambre (voir T-132).
 */

export interface CurrencyAmount {
  currency: string;
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
  const found = Object.keys(map).filter((currency) => map[currency] !== 0);
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

/**
 * Affichage d'une répartition : une devise → `formatPrice` seul
 * (identique au rendu historique EUR) ; plusieurs devises → liste jointe
 * par « + », chaque groupe formaté dans sa propre devise. Aucune somme
 * inter-devises n'est jamais affichée.
 */
export function formatCurrencyBreakdown(map: Record<string, number>, locale: string = "fr-FR"): string {
  const currencies = currenciesOf(map);
  if (currencies.length === 0) return formatPrice(0, "EUR", locale);
  return currencies.map((currency) => formatPrice(map[currency], currency, locale)).join(" + ");
}
