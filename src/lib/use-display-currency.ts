"use client";

import { useEffect, useState } from "react";

/**
 * T-131/T-132 — Préférences d'affichage (devise + langue) du visiteur.
 *
 * Devise : préférence de l'utilisateur connecté (`GET /api/auth/me`,
 * `user.currency`) ; sinon la devise par défaut de la plateforme
 * (`GET /api/app-preferences`, `defaultCurrency` — XAF en V1). Sert
 * UNIQUEMENT à l'affichage des prix d'aperçu : les paiements, totaux de
 * réservation, remboursements et le portefeuille restent toujours dans la
 * devise de la chambre/passerelle (aucune conversion transactionnelle).
 *
 * Langue : préférence de l'utilisateur (`user.language`) ; sinon la langue
 * par défaut plateforme. Les libellés localisés (voir `ui-strings`) et les
 * contenus EN des logements (`pickLocalized`) s'en servent.
 *
 * Les deux requêtes sont mises en cache au niveau module (une seule par
 * chargement de page, pas une par carte).
 */

export interface DisplayPreferences {
  /** Devise d'affichage (ex. "XAF"). Jamais null une fois prêt. */
  currency: string | null;
  /** Langue d'affichage ("fr" | "en" | "ar"). Jamais null une fois prêt. */
  language: string | null;
  /** true quand les préférences ont été résolues (ou échoué → défauts). */
  ready: boolean;
}

interface Resolved {
  currency: string | null;
  language: string | null;
}

let cached: Promise<Resolved> | null = null;

function load(): Promise<Resolved> {
  if (!cached) {
    cached = (async () => {
      // 1) Réglages plateforme (défauts publics, accessibles aux anonymes).
      let platformCurrency: string | null = null;
      let platformLanguage: string | null = null;
      try {
        const prefs = await fetch("/api/app-preferences", { cache: "no-store" });
        if (prefs.ok) {
          const p = await prefs.json();
          platformCurrency = typeof p?.defaultCurrency === "string" ? p.defaultCurrency.toUpperCase() : null;
          platformLanguage = typeof p?.defaultLanguage === "string" ? p.defaultLanguage : null;
        }
      } catch {
        // reste en repli codé en dur
      }

      // 2) Préférence utilisateur connecté (prime sur le défaut plateforme).
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        if (me.ok) {
          const data = await me.json();
          const u = data?.user;
          if (typeof u?.currency === "string" && u.currency) platformCurrency = u.currency.toUpperCase();
          if (typeof u?.language === "string" && u.language) platformLanguage = u.language;
        }
      } catch {
        // anonyme : on garde le défaut plateforme
      }

      return {
        currency: platformCurrency ?? "XAF",
        language: platformLanguage ?? "fr",
      };
    })();
  }
  return cached;
}

/** Réinitialise le cache (ex. après connexion/déconnexion ou changement de profil). */
export function resetDisplayPreferencesCache() {
  cached = null;
}

export function useDisplayPreferences(): DisplayPreferences {
  const [state, setState] = useState<DisplayPreferences>({ currency: null, language: null, ready: false });

  useEffect(() => {
    let cancelled = false;
    load().then((r) => {
      if (!cancelled) setState({ currency: r.currency, language: r.language, ready: true });
    });
    return () => { cancelled = true; };
  }, []);

  return state;
}

/**
 * Accès pratique à la seule devise (compatibilité T-131). Renvoie la devise
 * d'affichage résolue ou null tant que ce n'est pas prêt.
 */
export function useDisplayCurrency(): string | null {
  return useDisplayPreferences().currency;
}
