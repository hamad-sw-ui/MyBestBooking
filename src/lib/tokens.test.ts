import { describe, it, expect } from "vitest";
import { hashToken } from "./tokens";

describe("hashToken (T-013)", () => {
  it("produit un hash SHA-256 hex de 64 caractères", () => {
    const h = hashToken("hello");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("est déterministe", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("change complètement avec 1 bit d'input différent", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
