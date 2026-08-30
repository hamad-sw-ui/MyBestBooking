"use client";

import { useDisplayPreferences } from "@/lib/use-display-currency";
import { makeT } from "@/lib/ui-strings";
import { CurrencySelector } from "@/components/currency-selector";

/**
 * T-133 (A1) / T-134 — Champs de filtre de prix de la recherche.
 *
 * L'utilisateur saisit la fourchette dans sa devise d'affichage (XAF par
 * défaut plateforme, sinon sa préférence). Un champ caché `displayCurrency`
 * accompagne la soumission GET pour que le serveur convertisse les bornes
 * vers la devise de stockage (EUR) avant de filtrer — le filtre reste ainsi
 * cohérent avec les prix affichés en FCFA. Libellés localisés (T-134).
 */
export function SearchPriceFilter({
  minPrice,
  maxPrice,
  initialLanguage = null,
}: {
  minPrice?: string;
  maxPrice?: string;
  // T-164 : langue SSR (getServerLocale) → le sélecteur de devise rend son
  // libellé dans la bonne langue dès le premier HTML (pas de flash FR).
  initialLanguage?: string | null;
}) {
  const { currency, language } = useDisplayPreferences();
  const t = makeT(language);
  // Devise effective : XAF par défaut tant que les préférences ne sont pas
  // résolues (cohérent avec le défaut plateforme).
  const cur = (currency ?? "XAF").toUpperCase();
  const suffix = cur === "XAF" ? "FCFA" : cur;

  return (
    <>
      <input type="hidden" name="displayCurrency" value={cur} />
      {/* T-158 : sélecteur de devise d'affichage — le champ caché ci-dessus
          porte la valeur soumise ; la conversion serveur est inchangée. */}
      <div className="w-[130px]">
        <CurrencySelector initialLanguage={initialLanguage} />
      </div>
      <div className="w-[120px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">Prix min. ({suffix})</label>
        <input
          type="number"
          name="minPrice"
          min="0"
          step="1"
          defaultValue={minPrice}
          placeholder={`${suffix} min`}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
        />
      </div>
      <div className="w-[120px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">Prix max. ({suffix})</label>
        <input
          type="number"
          name="maxPrice"
          min="0"
          step="1"
          defaultValue={maxPrice}
          placeholder={`${suffix} max`}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
        />
      </div>
    </>
  );
}
