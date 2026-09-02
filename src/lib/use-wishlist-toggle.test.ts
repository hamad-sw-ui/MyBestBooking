import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  invalidateWishlistCache,
  resolveWishlists,
  WISHLISTS_CHANGED_EVENT,
} from "./use-wishlist-toggle";

/**
 * T-174 — preuve du correctif « cœurs de favoris figés après login ».
 * Scénario exact reproduit : visiteur anonyme → GET /api/wishlists = 401 →
 * cache figé à null ; après connexion (SPA, sans rechargement) l'invalidation
 * doit vider le cache et la prochaine résolution doit refetch la session
 * fraîche (listes réelles) au lieu de rejouer la promesse périmée.
 */

function fakeWindow() {
  const events: string[] = [];
  return {
    events,
    win: {
      dispatchEvent: (e: { type?: string }) => {
        events.push(e?.type ?? "");
        return true;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  };
}

function wishlistFetch(status: number, payload: unknown = null) {
  return vi.fn(async () => ({
    ok: status === 200,
    status,
    json: async () => payload,
  }) as Response);
}

describe("wishlist cache — invalidation session (T-174)", () => {
  beforeEach(() => {
    invalidateWishlistCache(); // cache module → état neutre entre tests
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("anonyme fige null ; sans invalidation la résolution reste périmée", async () => {
    const { win } = fakeWindow();
    vi.stubGlobal("window", win);
    const fetchSpy = wishlistFetch(401);
    vi.stubGlobal("fetch", fetchSpy);

    expect(await resolveWishlists()).toBeNull();
    // Comportement AVANT T-174 (défaut devenu impossible) : sans invalidation
    // explicite la promesse cachée serait rejouée ad vitam.
    expect(await resolveWishlists()).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("invalidateWishlistCache vide le cache, dispatch l'événement et re-fetch les listes du compte", async () => {
    const { win, events } = fakeWindow();
    vi.stubGlobal("window", win);

    // 1) anonyme → 401 → cache figé null
    vi.stubGlobal("fetch", wishlistFetch(401));
    expect(await resolveWishlists()).toBeNull();

    // 2) login (SPA) → invalidation
    invalidateWishlistCache();
    expect(events).toContain(WISHLISTS_CHANGED_EVENT);

    // 3) session fraîche → les listes réelles sont relues
    const payload = { wishlists: [{ id: "w1", items: [{ propertyId: "p9" }] }] };
    const fetchSpy = wishlistFetch(200, payload);
    vi.stubGlobal("fetch", fetchSpy);
    const after = await resolveWishlists();
    expect(after?.wishlists[0]?.items[0]?.propertyId).toBe("p9");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // une seule requête (dedup)
  });

  it("est SSR-safe : invalidate sans window ne lève rien", () => {
    vi.unstubAllGlobals();
    expect(() => invalidateWishlistCache()).not.toThrow();
  });
});
