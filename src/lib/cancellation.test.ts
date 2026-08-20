import { describe, it, expect } from "vitest";
import { computeCancellationFee, daysUntil } from "./cancellation";

describe("computeCancellationFee (T-016, §13.5)", () => {
  it("free = 0 quoi qu'il arrive", () => {
    expect(computeCancellationFee("free", 200, 0)).toBe(0);
    expect(computeCancellationFee("free", 200, 100)).toBe(0);
  });

  it("flexible : 0% si >= 1j, 100% sinon", () => {
    expect(computeCancellationFee("flexible", 200, 5)).toBe(0);
    expect(computeCancellationFee("flexible", 200, 1)).toBe(0);
    expect(computeCancellationFee("flexible", 200, 0)).toBe(200);
    expect(computeCancellationFee("flexible", 200, -1)).toBe(200);
  });

  it("moderate : 0/50/100 selon jours", () => {
    expect(computeCancellationFee("moderate", 200, 10)).toBe(0);
    expect(computeCancellationFee("moderate", 200, 5)).toBe(0);
    expect(computeCancellationFee("moderate", 200, 4)).toBe(100);
    expect(computeCancellationFee("moderate", 200, 1)).toBe(100);
    expect(computeCancellationFee("moderate", 200, 0)).toBe(200);
  });

  it("strict : 0 si ≥30, 50% si 7-29, 100% si <7", () => {
    expect(computeCancellationFee("strict", 200, 30)).toBe(0);
    expect(computeCancellationFee("strict", 200, 15)).toBe(100);
    expect(computeCancellationFee("strict", 200, 7)).toBe(100);
    expect(computeCancellationFee("strict", 200, 6)).toBe(200);
    expect(computeCancellationFee("strict", 200, 0)).toBe(200);
  });

  it("non_refundable : 100% toujours", () => {
    expect(computeCancellationFee("non_refundable", 200, 100)).toBe(200);
    expect(computeCancellationFee("non_refundable", 200, 0)).toBe(200);
  });

  it("policy inconnue → règle 'flexible' par défaut", () => {
    expect(computeCancellationFee("bizarre", 200, 5)).toBe(0);
    expect(computeCancellationFee(null, 200, 0)).toBe(200);
  });

  it("arrondi centime + jamais > total", () => {
    expect(computeCancellationFee("strict", 100, 15)).toBe(50);
    expect(computeCancellationFee("strict", 0.99, 0)).toBe(0.99);
  });
});

describe("daysUntil", () => {
  it("retourne un entier positif si futur", () => {
    const d = daysUntil("2099-01-15", new Date("2099-01-10"));
    expect(d).toBe(5);
  });
  it("retourne 0 si même jour", () => {
    const d = daysUntil("2099-01-10T20:00:00Z", new Date("2099-01-10T10:00:00Z"));
    expect(d).toBe(0);
  });
  it("retourne négatif si passé", () => {
    const d = daysUntil("2099-01-05", new Date("2099-01-10"));
    expect(d).toBeLessThan(0);
  });
});
