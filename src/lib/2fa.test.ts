import { describe, it, expect } from "vitest";
import speakeasy from "speakeasy";

/**
 * Test unitaire du contrat TOTP RFC 6238 utilisé par
 * /api/auth/2fa/{setup,verify,disable} (T-029).
 * Vérifie que speakeasy produit un code valide pour son propre secret,
 * et rejette un code faux.
 */

describe("TOTP (T-029)", () => {
  it("génère un secret base32 exploitable", () => {
    const s = speakeasy.generateSecret({ name: "MBB", length: 20 });
    expect(s.base32).toMatch(/^[A-Z2-7]+$/);
    expect(s.base32.length).toBeGreaterThan(20);
    expect(s.otpauth_url).toContain("otpauth://totp/");
  });

  it("verify accepte un code fraîchement généré", () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const token = speakeasy.totp({ secret, encoding: "base32" });
    const ok = speakeasy.totp.verify({ secret, encoding: "base32", token, window: 1 });
    expect(ok).toBe(true);
  });

  it("verify refuse un code invalide", () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const ok = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: "000000",
      window: 1,
    });
    expect(ok).toBe(false);
  });

  it("verify refuse un code d'un autre secret", () => {
    const s1 = speakeasy.generateSecret({ length: 20 }).base32;
    const s2 = speakeasy.generateSecret({ length: 20 }).base32;
    const token = speakeasy.totp({ secret: s1, encoding: "base32" });
    const ok = speakeasy.totp.verify({ secret: s2, encoding: "base32", token, window: 1 });
    expect(ok).toBe(false);
  });
});
