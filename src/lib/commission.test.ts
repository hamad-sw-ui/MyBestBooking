import { describe, expect, it } from "vitest";
import { resolveCommissionRate } from "./commission";

describe("commission (T-202) — priorité propriété > hôte > global", () => {
  it("le taux de propriété prime quand il est explicite", () => {
    expect(resolveCommissionRate("20", "12", 15)).toBe(20);
  });

  it("le taux hôte s'applique quand la propriété n'a pas de taux", () => {
    expect(resolveCommissionRate(null, "22", 15)).toBe(22);
    expect(resolveCommissionRate(undefined, "22", 15)).toBe(22);
  });

  it("le taux global s'applique quand ni propriété ni hôte n'ont de taux", () => {
    expect(resolveCommissionRate(null, null, 15)).toBe(15);
    expect(resolveCommissionRate(undefined, undefined, 15)).toBe(15);
  });

  it("borne le taux à [0, 100]", () => {
    expect(resolveCommissionRate(null, "120", 15)).toBe(100);
    expect(resolveCommissionRate(null, "-5", 15)).toBe(0);
  });

  it("traite les valeurs non numériques comme absentes (hérite)", () => {
    expect(resolveCommissionRate("not-a-number", "10", 15)).toBe(10);
  });
});
