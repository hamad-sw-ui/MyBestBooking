"use client";

import { useState } from "react";
import {
  useDisplayPreferences,
  resetDisplayPreferencesCache,
  UI_LANGUAGE_STORAGE_KEY,
} from "@/lib/use-display-currency";
import { makeT } from "@/lib/ui-strings";
import type { User as UserType } from "@/db/schema";

/**
 * T-152 (audit n°24, D) — Sélecteur de langue FR/EN du header.
 *
 * - Compte connecté : `PATCH /api/users/me { language }` (route existante,
 *   déjà gardée par `isUiLocale`) puis rechargement → toute l'UI
 *   (serveur + client) bascule sur la nouvelle langue.
 * - Anonyme : préférence dans `localStorage` (appliquée avant hydratation
 *   par le script `lang-init` du layout et lue par `useDisplayPreferences`
 *   avec la priorité compte > localStorage > plateforme > fr).
 *
 * Aucune nouvelle chaîne : plusieurs composants (header, recherche, fiche)
 * utilisent déjà `makeT` ; les écrans encore en français dur seront migrés
 * au fil de l'eau (voir opportunités T-152).
 */
export function LanguageSelector({ user }: { user: UserType | null }) {
  const { language } = useDisplayPreferences();
  const t = makeT(language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const value = local ?? language ?? "fr";

  async function change(next: string) {
    if (next === value) return;
    setLocal(next);
    setError(null);
    try {
      localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, next);
    } catch {
      // stockage indisponible : la préférence restera non persistée
    }
    document.documentElement.lang = next;
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
          throw new Error(data.error ?? "Impossible d'enregistrer la préférence");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible d'enregistrer la préférence");
        setSaving(false);
        // Pas de rechargement : la préférence n'a pas été persistée côté
        // compte, on laisse l'UI sur l'ancienne langue après retour.
        return;
      }
      setSaving(false);
    }
    resetDisplayPreferencesCache();
    window.location.reload();
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
