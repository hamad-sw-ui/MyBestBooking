import { describe, it, expect } from "vitest";
import {
  sumByCurrency,
  topCurrency,
  currenciesOf,
  hasMixedCurrencies,
  formatCurrencyBreakdown,
  sumByCurrencyConverted,
  formatCurrencyConverted,
} from "./currency-summary";
import { RATES_FROM_EUR } from "./i18n";

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

  it("sumByCurrencyConverted : mono-devise EUR → total inchangé, pas mélangé", () => {
    const r = sumByCurrencyConverted([{ currency: "EUR", amount: 1200 }], "EUR");
    expect(r).toEqual({ total: 1200, hasMixed: false });
  });

  it("sumByCurrencyConverted : convertit XAF → EUR à l'affichage (taux figés)", () => {
    const r = sumByCurrencyConverted([{ currency: "XAF", amount: 100000 }], "EUR");
    expect(r.total).toBeCloseTo(100000 / RATES_FROM_EUR.XAF, 2);
    expect(r.hasMixed).toBe(false);
  });

  it("sumByCurrencyConverted : multi-devises → total converti + drapeau mixed", () => {
    const r = sumByCurrencyConverted(
      [{ currency: "EUR", amount: 100 }, { currency: "XAF", amount: 655.957 * 50 }],
      "EUR",
    );
    expect(r.hasMixed).toBe(true);
    // 100 EUR + (655.957 XAF → 50 EUR) = 150 EUR
    expect(r.total).toBeCloseTo(150, 2);
  });

  it("sumByCurrencyConverted : devise inconnue ignorée (pas de conversion silencieuse)", () => {
    const r = sumByCurrencyConverted([{ currency: "ZZZ", amount: 100 }], "EUR");
    expect(r.total).toBeCloseTo(0, 5);
    expect(r.hasMixed).toBe(false);
  });

  it("formatCurrencyConverted : mono-devise EUR → rendu EUR historique", () => {
    expect(norm(formatCurrencyConverted({ EUR: 1234.5 }, "EUR"))).toBe("1 234,50 €");
  });

  it("formatCurrencyConverted : convertit une répartition XAF vers EUR", () => {
    const out = norm(formatCurrencyConverted({ XAF: 100000 }, "EUR"));
    expect(out).toContain("€");
    expect(out).not.toContain("XAF");
  });

  it("formatCurrencyConverted : map vide → 0,00 € (devise cible)", () => {
    expect(norm(formatCurrencyConverted({}, "USD"))).toBe("0,00 $US");
  });
});
