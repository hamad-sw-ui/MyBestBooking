"use client";

import { useEffect, useState } from "react";

/**
 * T-131 — Devise d'affichage préférée de l'utilisateur connecté.
 *
 * Lit `GET /api/auth/me` (`user.currency`) une seule fois par chargement de
 * page (promise mise en cache au niveau module pour ne pas déclencher une
 * requête par carte). Silencieux pour les anonymes (reste sur la devise
 * source). Sert UNIQUEMENT à l'affichage des prix d'aperçu ; les paiements et
 * totaux de réservation restent dans la devise de la chambre/passerelle
 * (aucune conversion monétaire côté transaction).
 */

let cached: Promise<string | null> | null = null;

function loadCurrency(): Promise<string | null> {
  if (!cached) {
    cached = (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data?.user?.currency === "string" ? data.user.currency.toUpperCase() : null;
      } catch {
        return null;
      }
    })();
  }
  return cached;
}

/** Permet la réinitialisation (ex. après connexion/déconnexion). */
export function resetDisplayCurrencyCache() {
  cached = null;
}

export function useDisplayCurrency(): string | null {
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCurrency().then((cur) => {
      if (!cancelled) setCurrency(cur);
    });
    return () => { cancelled = true; };
  }, []);

  return currency;
}
