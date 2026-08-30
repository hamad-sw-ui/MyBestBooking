import { describe, it, expect } from "vitest";
import { applyPromoToTotal, isPromoUsable, normalizePromoForCurrency, PromotionLike } from "./promotions";

function make(overrides: Partial<PromotionLike> = {}): PromotionLike {
  const inOneYear = new Date();
  inOneYear.setFullYear(inOneYear.getFullYear() + 1);
  return {
    code: "TEST",
    type: "percentage",
    value: "10",
    minBookingAmount: "0",
    maxDiscount: null,
    validFrom: new Date("2020-01-01"),
    validUntil: inOneYear,
    maxUses: null,
    currentUses: 0,
    isActive: true,
    ...overrides,
  };
}

describe("isPromoUsable (T-016, §13.5)", () => {
  it("OK pour promo standard", () => {
    expect(isPromoUsable(make())).toBe(true);
  });
  it("refuse promo inactive", () => {
    expect(isPromoUsable(make({ isActive: false }))).toBe("Code inactif");
  });
  it("refuse promo expirée", () => {
    expect(isPromoUsable(make({ validUntil: new Date("2020-01-01") }))).toBe("Code expiré");
  });
  it("refuse promo pas encore active", () => {
    expect(isPromoUsable(make({ validFrom: new Date("2099-01-01") }))).toBe("Code pas encore actif");
  });
  it("refuse promo épuisée", () => {
    expect(isPromoUsable(make({ maxUses: 5, currentUses: 5 }))).toBe("Code épuisé");
  });
});

describe("applyPromoToTotal (T-016, §13.5)", () => {
  it("percentage 10 % sur 200 = -20", () => {
    const r = applyPromoToTotal(make({ type: "percentage", value: "10" }), 200);
    expect(r).toEqual({ discount: 20, finalTotal: 180 });
  });
  it("fixed_amount 15 sur 200 = -15", () => {
    const r = applyPromoToTotal(make({ type: "fixed_amount", value: "15" }), 200);
    expect(r).toEqual({ discount: 15, finalTotal: 185 });
  });
  it("respecte maxDiscount (10 % sur 500 mais max 30)", () => {
    const r = applyPromoToTotal(
      make({ type: "percentage", value: "10", maxDiscount: "30" }),
      500,
    );
    expect(r).toEqual({ discount: 30, finalTotal: 470 });
  });
  it("refuse si total < minBookingAmount", () => {
    const r = applyPromoToTotal(make({ minBookingAmount: "100" }), 50);
    expect(r).toEqual({ error: "Réservation minimum 100.00" });
  });
  it("discount ne dépasse jamais le total (fixed 300 sur 200 = 200)", () => {
    const r = applyPromoToTotal(make({ type: "fixed_amount", value: "300" }), 200);
    expect(r).toEqual({ discount: 200, finalTotal: 0 });
  });
  it("arrondi centime", () => {
    const r = applyPromoToTotal(make({ type: "percentage", value: "7.5" }), 123.45);
    // 7.5 % = 9.25875 → arrondi 9.26 → total 114.19
    expect(r).toEqual({ discount: 9.26, finalTotal: 114.19 });
  });
});

describe("normalizePromoForCurrency (T-153, B — montants EUR → devise chambre)", () => {
  const fixed = {
    type: "fixed_amount",
    value: "20.00",
    minBookingAmount: "100.00",
    maxDiscount: "30.00",
  } as const;

  it("EUR : copie inchangée (identité, non-régression)", () => {
    const base = make(fixed);
    const n = normalizePromoForCurrency(base, "EUR");
    expect(n).toEqual(base);
    expect(n).not.toBe(base); // copie, jamais mutation
  });

  it("USD : value/min/max convertis au taux 1 EUR = 1,08 USD", () => {
    const n = normalizePromoForCurrency(make(fixed), "USD");
    expect(n.value).toBe("21.60");
    expect(n.minBookingAmount).toBe("108.00");
    expect(n.maxDiscount).toBe("32.40");
  });

  it("percentage : la valeur reste un pourcentage (non convertie)", () => {
    const n = normalizePromoForCurrency(make({ type: "percentage", value: "10", minBookingAmount: "100", maxDiscount: "30" }), "USD");
    expect(n.value).toBe("10");
    expect(n.minBookingAmount).toBe("108.00");
    expect(n.maxDiscount).toBe("32.40");
  });

  it("application bout-en-bout : fixed 20 € sur un total 200 $ = −21,60 $", () => {
    const r = applyPromoToTotal(normalizePromoForCurrency(make(fixed), "USD"), 200);
    expect(r).toEqual({ discount: 21.6, finalTotal: 178.4 });
  });

  it("seuils nuls restent nuls (pas de conversion de null)", () => {
    const n = normalizePromoForCurrency(make({ type: "fixed_amount", value: "20.00", minBookingAmount: null, maxDiscount: null }), "USD");
    expect(n.minBookingAmount).toBeNull();
    expect(n.maxDiscount).toBeNull();
  });

  it("devise inconnue → copie inchangée (comportement historique)", () => {
    const base = make(fixed);
    const n = normalizePromoForCurrency(base, "XYZ");
    expect(n).toEqual(base);
  });
});
