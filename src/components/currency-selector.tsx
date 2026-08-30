"use client";

import { useState } from "react";
import { UI_CURRENCY_OPTIONS } from "@/lib/i18n";
import {
  useDisplayPreferences,
  UI_CURRENCY_STORAGE_KEY,
  resetDisplayPreferencesCache,
} from "@/lib/use-display-currency";

/**
 * T-158 (audit n°29) — Sélecteur de devise d'affichage PUBLIC.
 *
 * Le filtre de prix de la recherche affichait les bornes dans la devise par
 * défaut de la plateforme (XAF) sans aucun moyen de la changer pour un
 * anonyme : un visiteur européen tapait « 100 » (= 0,15 €) et n'obtenait
 * rien. Ce sélecteur persiste la préférence en localStorage puis recharge :
 * `useDisplayPreferences` (priorité compte > localStorage > plateforme)
 * propage la devise aux libellés ET au champ caché `displayCurrency`
 * (conversion serveur des bornes inchangée — contrat T-133).
 */
export function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const { currency, language } = useDisplayPreferences();
  const [error, setError] = useState<string | null>(null);
  const current = (currency ?? "XAF").toUpperCase();

  async function change(next: string) {
    if (next === current) return;
    setError(null);
    try {
      window.localStorage.setItem(UI_CURRENCY_STORAGE_KEY, next);
    } catch {
      setError("Stockage indisponible");
      return;
    }
    resetDisplayPreferencesCache();
    // Rechargement : le SSR du formulaire lit `displayCurrency` soumis par
    // le client — le sélecteur ne casse jamais les URLs de recherche.
    window.location.reload();
  }

  const label = language === "en" ? "Display currency" : "Devise d'affichage";

  return (
    <label className={compact ? "inline-flex items-center gap-1 text-xs text-gray-500" : "block text-xs font-medium text-gray-500 mb-1"}>
      <span className="mr-1">{label}</span>
      <select
        aria-label={label}
        value={current}
        onChange={(e) => change(e.target.value)}
        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
      >
        {UI_CURRENCY_OPTIONS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      {error && <span className="text-red-600 ml-2">{error}</span>}
    </label>
  );
}
