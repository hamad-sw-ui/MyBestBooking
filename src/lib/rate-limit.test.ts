import { describe, it, expect, beforeEach } from "vitest";
import { guestQuotaKey, ipFromRequest, rateLimit, rateLimitMessage, _resetRateLimit } from "./rate-limit";
import { localizeApiMessage } from "./api-error";

describe("rate-limit (T-009, §13.5)", () => {
  beforeEach(() => _resetRateLimit());

  it("autorise sous la limite, refuse au-delà", () => {
    const key = "1.2.3.4:login";
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit(key, opts).ok).toBe(true);
    expect(rateLimit(key, opts).ok).toBe(true);
    expect(rateLimit(key, opts).ok).toBe(true);
    const denied = rateLimit(key, opts);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfter).toBeGreaterThan(0);
  });

  it("des clés différentes ont des compteurs indépendants", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("a", opts).ok).toBe(true);
    expect(rateLimit("b", opts).ok).toBe(true);
    expect(rateLimit("a", opts).ok).toBe(false);
  });

  it("libère les entrées après la fenêtre (simulé)", async () => {
    const opts = { limit: 1, windowMs: 5 };
    expect(rateLimit("c", opts).ok).toBe(true);
    expect(rateLimit("c", opts).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(rateLimit("c", opts).ok).toBe(true);
  });

  it("extrait l'IP depuis x-forwarded-for", () => {
    const r = new Request("http://x/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(ipFromRequest(r)).toBe("1.2.3.4");
  });

  it("fallback 'unknown' si aucun header IP", () => {
    const r = new Request("http://x/");
    expect(ipFromRequest(r)).toBe("unknown");
  });
});

/**
 * T-235 (audit n°3, F4) — quota de réservation : message explicite et clé de
 * visiteur non connecté.
 */
describe("T-235 — quota : délai lisible et clé invité", () => {
  it("arrondit le délai à la seconde puis à la minute, au pluriel si besoin", () => {
    expect(rateLimitMessage(1)).toBe("Trop de tentatives, réessayez dans 1 seconde");
    expect(rateLimitMessage(45)).toBe("Trop de tentatives, réessayez dans 45 secondes");
    expect(rateLimitMessage(60)).toBe("Trop de tentatives, réessayez dans 1 minute");
    expect(rateLimitMessage(61)).toBe("Trop de tentatives, réessayez dans 2 minutes");
    // Valeur nulle ou négative (horloge) : jamais « dans 0 seconde ».
    expect(rateLimitMessage(0)).toBe("Trop de tentatives, réessayez dans 1 seconde");
  });

  it("traduit le délai en anglais", () => {
    expect(localizeApiMessage("Trop de tentatives, réessayez dans 1 seconde", "en")).toBe(
      "Too many attempts, try again in 1 second",
    );
    expect(localizeApiMessage("Trop de tentatives, réessayez dans 3 minutes", "en")).toBe(
      "Too many attempts, try again in 3 minutes",
    );
  });

  it("préfère le cookie visiteur à l'IP partagée", () => {
    const request = new Request("http://localhost/api/bookings", {
      headers: {
        cookie: "autre=1; mbb_guest=visiteur-abc; theme=dark",
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      },
    });
    expect(guestQuotaKey(request)).toBe("guest-cookie:visiteur-abc");
  });

  it("retombe sur l'IP quand le cookie est absent", () => {
    const request = new Request("http://localhost/api/bookings", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(guestQuotaKey(request)).toBe("guest-ip:203.0.113.7");
  });

  it("deux visiteurs derrière la même IP ont des compteurs distincts", () => {
    _resetRateLimit();
    const opts = { limit: 1, windowMs: 60_000 };
    const visiteurA = new Request("http://localhost/api/bookings", {
      headers: { cookie: "mbb_guest=A", "x-forwarded-for": "203.0.113.7" },
    });
    const visiteurB = new Request("http://localhost/api/bookings", {
      headers: { cookie: "mbb_guest=B", "x-forwarded-for": "203.0.113.7" },
    });
    expect(rateLimit(guestQuotaKey(visiteurA), opts).ok).toBe(true);
    expect(rateLimit(guestQuotaKey(visiteurA), opts).ok).toBe(false);
    // B n'est pas puni par les essais de A.
    expect(rateLimit(guestQuotaKey(visiteurB), opts).ok).toBe(true);
  });
});
