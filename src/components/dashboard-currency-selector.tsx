"use client";

import { useState } from "react";
import {
  useDisplayPreferences,
  resetDisplayPreferencesCache,
} from "@/lib/use-display-currency";
import { useT } from "@/components/ui-locale-provider";

/**
 * T-195 — Sélecteur de devise d'affichage de l'espace hôte/admin.
 *
 * Différence avec le <CurrencySelector> public (recherche) : celui-ci est
 * réservé aux visiteurs anonymes et ne persiste qu'en localStorage. Or un
 * compte connecté est TOUJOURS prioritaire sur `user.currency` dans
 * `useDisplayPreferences` : pour qu'un hôte/admin puisse réellement changer
 * sa devise d'affichage, il faut persister la préférence AU NIVEAU DU
 * COMPTE via `PATCH /api/users/me { currency }` (même pattern que
 * <LanguageSelector> pour la langue).
 *
 * Options bornées aux devises réellement exposées par le panneau admin
 * (`supportedCurrencies` = EUR/USD/GBP/XAF) — on n'offre pas EUR pour rien,
 * ni CHF/MAD (convertibles mais non proposées).
 *
 * Affichage uniquement : la devise d'affichage ne convertit jamais un montant
 * transactionnel (paiement, remboursement, portefeuille restent la devise de
 * la chambre — règle T-132).
 */
const DASHBOARD_CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "XAF"] as const;

export function DashboardCurrencySelector({ compact = false }: { compact?: boolean }) {
  const { currency } = useDisplayPreferences();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = (currency ?? "EUR").toUpperCase();

  async function change(next: string) {
    if (next === current || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currency: next }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? t("nav.languageSaveError"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("nav.languageSaveError"));
      setSaving(false);
      return;
    }
    setSaving(false);
    // Cache vidé + re-résolution : `useDisplayPreferences` refetch `/api/auth/me`
    // et propage la nouvelle devise au dashboard.
    resetDisplayPreferencesCache();
    window.location.reload();
  }

  const label = t("currency.displayLabel");

  return (
    <label className={compact ? "inline-flex items-center gap-1 text-xs text-gray-500" : "block text-xs font-medium text-gray-500 mb-1"}>
      <span className="mr-1">{label}</span>
      <select
        aria-label={label}
        value={current}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 disabled:opacity-50"
      >
        {DASHBOARD_CURRENCY_OPTIONS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      {error && <span className="text-red-600 ml-2" role="alert">{error}</span>}
    </label>
  );
}
