/**
 * T-182 — tests unitaires du cache de lecture TTL.
 * Horloge injectée ? Non : le module lit Date.now() directement — on pilote
 * avec vi.useFakeTimers() pour tester l'expiration sans attendre.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { createTtlCache } from "./read-cache";

describe("createTtlCache (T-182)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sert la valeur mémorisée sans ré-exécuter la fonction", async () => {
    const cache = createTtlCache({ ttlMs: 1_000 });
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return "valeur";
    };
    expect(await cache.wrap("k", fn)).toBe("valeur");
    expect(await cache.wrap("k", fn)).toBe("valeur");
    expect(calls).toBe(1);
    expect(cache.size()).toBe(1);
  });

  it("expire après le TTL", async () => {
    vi.useFakeTimers();
    const cache = createTtlCache({ ttlMs: 60_000 });
    let calls = 0;
    const fn = async () => `run-${++calls}`;
    expect(await cache.wrap("k", fn)).toBe("run-1");
    vi.setSystemTime(Date.now() + 59_999);
    expect(await cache.wrap("k", fn)).toBe("run-1");
    vi.setSystemTime(Date.now() + 2); // ≥ 60 001 ms depuis le set
    expect(await cache.wrap("k", fn)).toBe("run-2");
    expect(calls).toBe(2);
  });

  it("isole les clés", async () => {
    const cache = createTtlCache({ ttlMs: 1_000 });
    await cache.wrap("paris", async () => 1);
    await cache.wrap("lyon", async () => 2);
    expect(cache.get("paris")).toBe(1);
    expect(cache.get("lyon")).toBe(2);
    expect(cache.get("rome")).toBeUndefined();
  });

  it("borne la mémoire (cap) en évinçant les plus anciennes", () => {
    const cache = createTtlCache({ ttlMs: 60_000, cap: 3 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4);
    expect(cache.size()).toBe(3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("d")).toBe(4);
  });

  it("n'héberge pas de valeur expirée (get purge)", () => {
    vi.useFakeTimers();
    const cache = createTtlCache({ ttlMs: 500 });
    cache.set("x", 42);
    vi.setSystemTime(Date.now() + 501);
    expect(cache.get("x")).toBeUndefined();
    expect(cache.size()).toBe(0);
  });

  it("ré-exécute après del()", async () => {
    const cache = createTtlCache({ ttlMs: 60_000 });
    let calls = 0;
    const fn = async () => ++calls;
    expect(await cache.wrap("k", fn)).toBe(1);
    cache.del("k");
    expect(await cache.wrap("k", fn)).toBe(2);
  });
});
