import { describe, it, expect } from "vitest";
import {
  computeCancellationFee,
  computeCancellationFeeWithGrid,
  daysUntil,
} from "./cancellation";
import type { CancellationGrid } from "./settings";

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

describe("computeCancellationFeeWithGrid (T-021)", () => {
  it("grille custom : écrase la grille par défaut", () => {
    const grid: CancellationGrid = {
      free: [{ days: 0, percent: 0 }],
      flexible: [
        { days: 3, percent: 0 },
        { days: 0, percent: 100 },
      ],
      moderate: [{ days: 0, percent: 25 }],
      strict: [
        { days: 60, percent: 0 },
        { days: 0, percent: 100 },
      ],
      non_refundable: [{ days: 0, percent: 100 }],
    };
    // flexible custom : 100% en dessous de 3 jours
    expect(computeCancellationFeeWithGrid("flexible", 200, 2, grid)).toBe(200);
    expect(computeCancellationFeeWithGrid("flexible", 200, 3, grid)).toBe(0);
    // moderate custom : 25% tout le temps
    expect(computeCancellationFeeWithGrid("moderate", 200, 100, grid)).toBe(50);
    // strict custom : jusqu'à 60j pour être à 0
    expect(computeCancellationFeeWithGrid("strict", 200, 30, grid)).toBe(200);
    expect(computeCancellationFeeWithGrid("strict", 200, 60, grid)).toBe(0);
  });

  it("grille null → fallback vers la grille par défaut", () => {
    expect(computeCancellationFeeWithGrid("strict", 200, 15, null)).toBe(100);
    expect(computeCancellationFeeWithGrid("flexible", 200, 0, undefined)).toBe(200);
  });

  it("policy absente de la grille custom → règle sécurisante flexible", () => {
    const grid: CancellationGrid = {
      free: [{ days: 0, percent: 0 }],
      flexible: [
        { days: 1, percent: 0 },
        { days: 0, percent: 100 },
      ],
      moderate: [{ days: 0, percent: 100 }],
      strict: [{ days: 0, percent: 100 }],
      non_refundable: [{ days: 0, percent: 100 }],
    };
    expect(computeCancellationFeeWithGrid("unknown", 200, 5, grid)).toBe(0);
    expect(computeCancellationFeeWithGrid("unknown", 200, 0, grid)).toBe(200);
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
