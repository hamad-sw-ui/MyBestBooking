import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  invalidateDisplayPreferences,
  resetDisplayPreferencesCache,
  resolveDisplayPreferences,
  DISPLAY_PREFS_EVENT,
} from "./use-display-currency";

/**
 * T-173 — preuve unitaire du correctif « bascule de langue non fiable » :
 * le cache des préférences doit être réellement invalidé (re-fetch) quand
 * l'état d'authentification change (login/register), et l'événement doit
 * être dispatché pour resynchroniser les composants montés.
 */

function fakeWindow(localLanguage: string | null) {
  const store = new Map<string, string>();
  if (localLanguage) store.set("mybb:ui-language", localLanguage);
  const events: string[] = [];
  return {
    events,
    win: {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      dispatchEvent: (e: { type?: string }) => {
        events.push(e?.type ?? "");
        return true;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  };
}

function stubFetch(meStatus: number, meBody: unknown = null) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/api/auth/me")) {
      return {
        ok: meStatus === 200,
        status: meStatus,
        json: async () => (meStatus === 200 ? meBody : {}),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ defaultCurrency: "XAF", defaultLanguage: "fr" }),
    } as Response;
  });
}

describe("display preferences — invalidation (T-173)", () => {
  beforeEach(() => {
    resetDisplayPreferencesCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("résout depuis le localStorage anonyme, puis met en cache (un seul fetch)", async () => {
    const { win } = fakeWindow("en");
    vi.stubGlobal("window", win);
    const fetchSpy = stubFetch(401);
    vi.stubGlobal("fetch", fetchSpy);

    const first = await resolveDisplayPreferences();
    expect(first.language).toBe("en");
    expect(first.currency).toBe("XAF");
    const callsAfterFirst = fetchSpy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await resolveDisplayPreferences();
    expect(second.language).toBe("en");
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst); // cache utilisé
  });

  it("invalidateDisplayPreferences vide le cache ET dispatch l'événement", async () => {
    const { win, events } = fakeWindow("en");
    vi.stubGlobal("window", win);
    const fetchSpy = stubFetch(401);
    vi.stubGlobal("fetch", fetchSpy);

    await resolveDisplayPreferences();
    const callsBefore = fetchSpy.mock.calls.length;

    invalidateDisplayPreferences();
    expect(events).toContain(DISPLAY_PREFS_EVENT);

    // Après invalidation, la session fraîche (compte fr) est re-lue :
    // c'est exactement le scénario login (anonyme en → compte fr).
    vi.stubGlobal("fetch", stubFetch(200, { user: { language: "fr", currency: "EUR" } }));
    const after = await resolveDisplayPreferences();
    expect(after.language).toBe("fr"); // compte prioritaire, plus ancien cache
    expect(after.currency).toBe("EUR");
    expect(callsBefore).toBeGreaterThan(0);
  });

  it("est SSR-safe : invalidate sans window ne lève rien", () => {
    vi.unstubAllGlobals();
    expect(() => invalidateDisplayPreferences()).not.toThrow();
  });
});
