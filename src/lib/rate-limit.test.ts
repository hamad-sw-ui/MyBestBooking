import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, _resetRateLimit, ipFromRequest } from "./rate-limit";

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
