"use client";

import { useEffect, useState } from "react";
import { normalizeDisplayCurrency } from "@/lib/i18n";
import { isUiLocale } from "@/lib/ui-strings";
import { UI_LANGUAGE_STORAGE_KEY, readUiLanguageCookie } from "@/lib/ui-language";

export { UI_LANGUAGE_STORAGE_KEY };

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

/** T-158 (audit n°29) : clé de persistance locale du sélecteur de devise. */
export const UI_CURRENCY_STORAGE_KEY = "mybb:ui-currency";

export interface DisplayPreferences {
  /** Devise d'affichage (ex. "XAF"). Jamais null une fois prêt. */
  currency: string | null;
  /** Langue d'affichage ("fr" | "en"). Jamais null une fois prêt. */
  language: string | null;
  /** true quand les préférences ont été résolues (ou échoué → défauts). */
  ready: boolean;
}

interface Resolved {
  currency: string | null;
  language: string | null;
}

let cached: Promise<Resolved> | null = null;

/**
 * T-173 — Événement d'invalidation des préférences d'affichage.
 *
 * Constats terrain : après connexion/inscription la navigation est SPA
 * (`router.push` + `router.refresh`, sans plein rechargement). La promesse
 * `cached` restait donc figée sur la résolution **anonyme** (language issu
 * du localStorage) alors que le serveur re-rendait avec la langue **du
 * compte** → page mixte FR/EN jusqu'au prochain F5.
 *
 * `invalidateDisplayPreferences()` vide le cache ET notifie tous les hooks
 * montés : chacun relance `load()` et se synchronise (compte désormais
 * joint via la session fraîche → priorité compte respectée partout).
 */
export const DISPLAY_PREFS_EVENT = "mybb:display-preferences-changed";

/** Réinitialise le cache (ex. juste avant un rechargement complet). */
export function resetDisplayPreferencesCache() {
  cached = null;
}

/** Cache vidé + tous les hooks avertis → re-résolution immédiate. */
export function invalidateDisplayPreferences() {
  cached = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DISPLAY_PREFS_EVENT));
  }
}

/** Résolution (cached) utilisable hors hook — requêtes + fallbacks. */
export function resolveDisplayPreferences(): Promise<Resolved> {
  return load();
}

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
      //    T-135 : on borne sur les valeurs réellement supportées pour
      //    qu'une préférence aberrante (« ZZZ », « ar » — issue d'anciennes
      //    données ou d'un appel direct à l'API) ne casse pas l'affichage :
      //    devise inconnue → devise plateforme/XAF, langue non traduite → « fr ».
      let userLanguage: string | null = null;
      let hasUserCurrency = false;
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        if (me.ok) {
          const data = await me.json();
          const u = data?.user;
          if (typeof u?.currency === "string" && u.currency) {
            platformCurrency = u.currency.toUpperCase();
            hasUserCurrency = true;
          }
          if (typeof u?.language === "string" && u.language && isUiLocale(u.language)) {
            userLanguage = u.language;
          }
        }
      } catch {
        // anonyme : on garde le défaut plateforme
      }
      // T-152 (D) : priorité compte connecté > localStorage (sélecteur
      // header, anonyme) > défaut plateforme > fr. La préférence locale ne
      // prend jamais le pas sur le profil du compte connecté.
      if (userLanguage) {
        platformLanguage = userLanguage;
      } else {
        let stored: string | null = null;
        try {
          stored = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
        } catch {
          // localStorage indisponible
        }
        if (!stored) {
          try {
            stored = readUiLanguageCookie(document.cookie);
          } catch {
            // document.cookie indisponible
          }
        }
        if (stored && isUiLocale(stored)) platformLanguage = stored;
      }
      // T-158 : même priorité pour la devise — le sélecteur public de la
      // recherche (anonyme) persiste en localStorage ; un compte connecté
      // reste maître (préférence profil), jamais écrasée.
      if (!hasUserCurrency) {
        try {
          const stored = window.localStorage.getItem(UI_CURRENCY_STORAGE_KEY);
          if (stored) platformCurrency = stored.toUpperCase();
        } catch {
          // localStorage indisponible : défaut plateforme
        }
      }

      return {
        currency: normalizeDisplayCurrency(platformCurrency, "XAF"),
        language: isUiLocale(platformLanguage) ? platformLanguage : "fr",
      };
    })();
  }
  return cached;
}

export function useDisplayPreferences(): DisplayPreferences {
  const [state, setState] = useState<DisplayPreferences>({ currency: null, language: null, ready: false });

  useEffect(() => {
    let cancelled = false;
    const reload = () => {
      load().then((r) => {
        if (!cancelled) setState({ currency: r.currency, language: r.language, ready: true });
      });
    };
    reload();
    // T-173 : re-résolution sur invalidation explicite (login/register, profil
    // mis à jour) — sans cela le cache de module gardait la langue anonyme
    // après connexion (UI mixte FR/EN jusqu'au prochain plein chargement).
    if (typeof window !== "undefined") {
      window.addEventListener(DISPLAY_PREFS_EVENT, reload);
      return () => {
        cancelled = true;
        window.removeEventListener(DISPLAY_PREFS_EVENT, reload);
      };
    }
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
