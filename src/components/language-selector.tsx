"use client";

import { useState } from "react";
import {
  useDisplayPreferences,
  resetDisplayPreferencesCache,
} from "@/lib/use-display-currency";
import { persistUiLanguageClient } from "@/lib/ui-language";
import { useT } from "@/components/ui-locale-provider";
import type { User as UserType } from "@/db/schema";

/**
 * T-152 (audit n°24, D) — Sélecteur de langue FR/EN du header.
 *
 * - Compte connecté : `PATCH /api/users/me { language }` (route existante,
 *   déjà gardée par `isUiLocale`) puis rechargement → toute l'UI
 *   (serveur + client) bascule sur la nouvelle langue.
 * - Anonyme : `persistUiLanguageClient` (localStorage + cookies) puis
 *   navigation `?lang=` : le proxy tamponne `x-ui-language` même si le
 *   cookie iframe est bloqué. `getServerLocale` lit header → cookies.
 *
 * Aucune nouvelle chaîne : plusieurs composants (header, recherche, fiche)
 * utilisent déjà `makeT` ; les écrans encore en français dur seront migrés
 * au fil de l'eau (voir opportunités T-152).
 */
export function LanguageSelector({ user, initialLanguage = null }: { user: UserType | null; initialLanguage?: string | null }) {
  const { language } = useDisplayPreferences();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const value = local ?? language ?? initialLanguage ?? "fr";

  async function change(next: string) {
    if (next === value) return;
    setLocal(next);
    setError(null);
    persistUiLanguageClient(next);
    if (user) {
      setSaving(true);
      try {
        const response = await fetch("/api/users/me", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ language: next }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? t("nav.languageSaveError"));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t("nav.languageSaveError"));
        setSaving(false);
        // Pas de rechargement : la préférence n'a pas été persistée côté
        // compte, on laisse l'UI sur l'ancienne langue après retour.
        return;
      }
      setSaving(false);
    }
    resetDisplayPreferencesCache();
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.location.assign(url.toString());
  }

  return (
    <label className="flex items-center gap-1">
      <select
        aria-label={t("account.language")}
        title={t("account.language")}
        value={value}
        disabled={saving}
        onChange={(event) => change(event.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
      >
        <option value="fr">FR</option>
        <option value="en">EN</option>
      </select>
      {error && (
        <span className="text-xs text-red-600 max-w-32" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
