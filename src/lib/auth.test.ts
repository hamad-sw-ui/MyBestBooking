import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Ces tests vérifient le contrat du module auth.ts vis-à-vis de JWT_SECRET
// (T-001, BUG-001). Ils sont écrits indépendamment de l'implémentation :
// ils partent du contrat (« throw si absent, warn si court, fonctionne
// sinon ») et non du code, satisfaisant la double validation §13.5.

describe("auth.ts — invariant JWT_SECRET (T-001, §13.5)", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    // Copie propre pour ne pas polluer les autres tests
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("throw explicitement si JWT_SECRET est absent", async () => {
    delete process.env.JWT_SECRET;
    await expect(() => import("./auth")).rejects.toThrow(/JWT_SECRET is required/);
  });

  it("throw également si JWT_SECRET est vide", async () => {
    process.env.JWT_SECRET = "";
    await expect(() => import("./auth")).rejects.toThrow(/JWT_SECRET is required/);
  });

  it("le message d'erreur mentionne openssl rand -hex 32 (aide au diagnostic)", async () => {
    delete process.env.JWT_SECRET;
    try {
      await import("./auth");
      throw new Error("should have thrown");
    } catch (e) {
      expect(String(e)).toMatch(/openssl rand -hex 32/);
    }
  });

  it("émet un warning si JWT_SECRET fait moins de 32 caractères", async () => {
    process.env.JWT_SECRET = "short-secret";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("./auth");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/shorter than 32/));
    warnSpy.mockRestore();
  });

  it("ne warn pas si JWT_SECRET fait ≥ 32 caractères", async () => {
    process.env.JWT_SECRET = "a".repeat(64);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("./auth");
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("hashPassword + verifyPassword fonctionnent avec un secret valide", async () => {
    process.env.JWT_SECRET = "a".repeat(64);
    const { hashPassword, verifyPassword } = await import("./auth");
    const hash = await hashPassword("mon-mot-de-passe");
    expect(hash).not.toBe("mon-mot-de-passe");
    await expect(verifyPassword("mon-mot-de-passe", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("createToken puis verifyToken font un round-trip cohérent", async () => {
    process.env.JWT_SECRET = "a".repeat(64);
    const { createToken, verifyToken } = await import("./auth");
    const token = await createToken("user-uuid-abc");
    const payload = await verifyToken(token);
    expect(payload).toEqual({ userId: "user-uuid-abc" });
  });

  it("verifyToken retourne null pour un token invalide", async () => {
    process.env.JWT_SECRET = "a".repeat(64);
    const { verifyToken } = await import("./auth");
    expect(await verifyToken("not-a-jwt")).toBeNull();
  });

  it("un JWT signé avec un autre secret n'est pas vérifiable", async () => {
    // Contrat clé de sécurité : deux serveurs avec deux secrets différents
    // ne se reconnaissent pas mutuellement. C'est précisément ce que
    // BUG-001 cassait via son fallback publiquement lisible.
    process.env.JWT_SECRET = "a".repeat(64);
    const { createToken } = await import("./auth");
    const tokenA = await createToken("user-A");

    vi.resetModules();
    process.env.JWT_SECRET = "b".repeat(64);
    const { verifyToken } = await import("./auth");
    expect(await verifyToken(tokenA)).toBeNull();
  });
});
