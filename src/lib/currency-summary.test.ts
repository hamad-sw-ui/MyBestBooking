import { describe, it, expect } from "vitest";
import {
  sumByCurrency,
  topCurrency,
  currenciesOf,
  hasMixedCurrencies,
  formatCurrencyBreakdown,
} from "./currency-summary";

/** Intl.NumberFormat (« fr-FR ») utilise espaces insécables (U+00A0/U+202F) : on normalise. */
const norm = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

describe("currency-summary (T-152, finding C)", () => {
  it("sumByCurrency additionne par devise sans jamais mélanger", () => {
    const map = sumByCurrency([
      { currency: "EUR", amount: 100 },
      { currency: "USD", amount: 50 },
      { currency: "eur", amount: 25.5 }, // normalisation casse
      { currency: "", amount: 10 }, // repli EUR
      { currency: "GBP", amount: Number.NaN }, // ignoré
    ]);
    expect(map).toEqual({ EUR: 135.5, USD: 50 });
  });

  it("sumByCurrency retourne une map vide sans entrées", () => {
    expect(sumByCurrency([])).toEqual({});
  });

  it("topCurrency : devise la plus grande, EUR prioritaire à égalité", () => {
    expect(topCurrency({ EUR: 10, USD: 20 })).toBe("USD");
    expect(topCurrency({ USD: 20, EUR: 20 })).toBe("EUR");
    expect(topCurrency({ EUR: 0 })).toBeNull();
    expect(topCurrency({})).toBeNull();
  });

  it("currenciesOf / hasMixedCurrencies : ordre stable et détection", () => {
    expect(currenciesOf({ USD: 5, EUR: 10, GBP: 3 })).toEqual(["EUR", "GBP", "USD"]);
    expect(currenciesOf({ EUR: 0, USD: 0 })).toEqual([]);
    expect(hasMixedCurrencies({ EUR: 10, USD: 5 })).toBe(true);
    expect(hasMixedCurrencies({ EUR: 10 })).toBe(false);
  });

  it("formatCurrencyBreakdown : une devise → rendu historique EUR", () => {
    expect(norm(formatCurrencyBreakdown({ EUR: 1234.5 }))).toBe("1 234,50 €");
  });

  it("formatCurrencyBreakdown : devises multiples → liste jointe, jamais additionnées", () => {
    const out = norm(formatCurrencyBreakdown({ EUR: 100, USD: 50 }));
    expect(out).toContain("100,00 €");
    expect(out).toContain("$US");
    expect(out).toContain(" + ");
    // 100 + 50 = 150 ne doit JAMAIS apparaître comme un total unique
    expect(out).not.toContain("150,00");
  });

  it("formatCurrencyBreakdown : map vide → 0,00 €", () => {
    expect(norm(formatCurrencyBreakdown({}))).toBe("0,00 €");
  });
});
