"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * T-154c (audit n°26, P2-6) — état favori + bascule ajout/retrait.
 *
 * Avant : le cœur n'était qu'un ajout (`wishlists[0]`), ne reflétait jamais
 * l'état réel (toujours « idle » au chargement, même si le bien était déjà en
 * favori) et ne pouvait jamais retirer un favori unitaire (le DELETE
 * `?propertyId` existait côté API mais n'était jamais appelé).
 *
 * Ici : GET /api/wishlists (mis en cache par propriété de module pour éviter
 * une requête par carte) → on retrouve la liste contenant le bien ; clic
 * suivant = DELETE `?wishlistId&propertyId` ; clic sur cœur vide = ajout dans
 * la première liste (comportement historique) puis bascule.
 */

type WishlistItem = { propertyId: string };
type Wishlist = { id: string; items: WishlistItem[] };
type WishlistsPayload = { wishlists: Wishlist[] };

let cachedPayload: Promise<WishlistsPayload | null> | null = null;

async function fetchWishlists(): Promise<WishlistsPayload | null> {
  const res = await fetch("/api/wishlists");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Impossible de charger vos favoris");
  return (await res.json()) as WishlistsPayload;
}

function getCachedWishlists(): { get: () => Promise<WishlistsPayload | null>; refresh: () => void } {
  if (!cachedPayload) cachedPayload = fetchWishlists();
  return {
    get: () => cachedPayload ?? Promise.resolve(null),
    refresh: () => {
      cachedPayload = null;
    },
  };
}

export function useWishlistToggle(propertyId: string) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    getCachedWishlists()
      .get()
      .then((data) => {
        if (ignore || !data) return;
        const list = data.wishlists.find((w) =>
          w.items.some((i) => i.propertyId === propertyId),
        );
        setSaved(Boolean(list));
        setWishlistId(list?.id ?? data.wishlists[0]?.id ?? null);
      })
      .catch(() => {
        /* silencieux : le cœur reste « vide », l'ajout affichera l'erreur */
      });
    return () => {
      ignore = true;
    };
  }, [propertyId]);

  const toggle = useCallback(async (): Promise<"ok" | "unauthenticated"> => {
    if (busy) return "ok";
    setBusy(true);
    setError(null);
    try {
      if (saved && wishlistId) {
        const res = await fetch(
          `/api/wishlists?wishlistId=${encodeURIComponent(wishlistId)}&propertyId=${encodeURIComponent(propertyId)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("Impossible de retirer le favori");
        setSaved(false);
        getCachedWishlists().refresh();
        return "ok";
      }

      const data = await getCachedWishlists().get();
      if (data === null) return "unauthenticated";
      let list = data.wishlists[0];
      if (!list) {
        const created = await fetch("/api/wishlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Mes favoris" }),
        });
        if (!created.ok) throw new Error("Impossible de créer votre liste");
        list = (await created.json()).wishlist;
      }
      const addRes = await fetch("/api/wishlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlistId: list.id, propertyId }),
      });
      if (!addRes.ok) {
        const body = await addRes.json().catch(() => ({}));
        if (!String(body.error).includes("déjà")) throw new Error(body.error ?? "Impossible d'ajouter le favori");
      }
      setSaved(true);
      setWishlistId(list.id);
      getCachedWishlists().refresh();
      return "ok";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      return "ok";
    } finally {
      setBusy(false);
    }
  }, [busy, saved, wishlistId, propertyId]);

  return { saved, busy, error, toggle };
}
