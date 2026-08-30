import { describe, it, expect } from "vitest";
import {
  pickLocalized,
  convertAmount,
  formatMoney,
  priceBoundToStorage,
  RATES_FROM_EUR,
  isDisplayCurrency,
  normalizeDisplayCurrency,
  DISPLAY_CURRENCIES,
  isZeroDecimalCurrency,
  toMinorUnits,
} from "./i18n";

describe("pickLocalized (T-029)", () => {
  it("locale fr → row inchangée", () => {
    const r = { description: "Riad", descriptionEn: "Traditional guesthouse" };
    expect(pickLocalized(r, { description: "descriptionEn" }, "fr")).toBe(r);
  });

  it("locale en → substitue le champ traduit s'il existe", () => {
    const r = { description: "Riad traditionnel", descriptionEn: "Traditional guesthouse" };
    const out = pickLocalized(r, { description: "descriptionEn" }, "en");
    expect(out.description).toBe("Traditional guesthouse");
    // champ traduit toujours présent
    expect(out.descriptionEn).toBe("Traditional guesthouse");
  });

  it("locale en sans champ traduit → garde le fr", () => {
    const r = { description: "Riad traditionnel", descriptionEn: null };
    const out = pickLocalized(r, { description: "descriptionEn" }, "en");
    expect(out.description).toBe("Riad traditionnel");
  });

  it("locale inconnue (ar) → row inchangée (V1)", () => {
    const r = { description: "Riad" };
    expect(pickLocalized(r, { description: "descriptionEn" }, "ar")).toStrictEqual(r);
  });
});

describe("convertAmount (T-029)", () => {
  it("EUR → EUR = identité", () => {
    expect(convertAmount(100, "EUR", "EUR")).toBe(100);
  });

  it("EUR → USD applique le taux", () => {
    const usd = convertAmount(100, "EUR", "USD");
    expect(usd).toBe(RATES_FROM_EUR.USD * 100);
  });

  it("USD → EUR est symétrique aux arrondis près", () => {
    const eur = convertAmount(108, "USD", "EUR");
    expect(eur).toBeCloseTo(100, 1);
  });

  it("XAF → EUR petit montant", () => {
    const eur = convertAmount(655.957, "XAF", "EUR");
    expect(eur).toBeCloseTo(1, 2);
  });

  it("devise inconnue → identité neutre", () => {
    expect(convertAmount(100, "ZZZ", "EUR")).toBe(100);
  });
});

describe("formatMoney (T-029)", () => {
  it("formatte EUR en fr-FR", () => {
    const s = formatMoney(1234.5, "EUR", "fr-FR");
    // Le format contient \u00a0 (nbsp) entre nombre et symbole selon le
    // runtime — on teste juste la présence.
    expect(s).toMatch(/1[\s\u00a0]?234[.,]50/);
    expect(s).toContain("€");
  });

  it("formatte USD en en-US", () => {
    const s = formatMoney(1234.5, "USD", "en-US");
    expect(s).toContain("$");
    expect(s).toContain("1,234.50");
  });

  it("devise inconnue → fallback plain", () => {
    const s = formatMoney(100, "ZZZ_BOGUS", "fr-FR");
    expect(s).toMatch(/100/);
  });
});

describe("priceBoundToStorage (T-133 / A1)", () => {
  it("sans devise → valeur saisie inchangée (historique)", () => {
    expect(priceBoundToStorage(100)).toBe(100);
    expect(priceBoundToStorage(100, null)).toBe(100);
  });

  it("EUR → valeur saisie inchangée", () => {
    expect(priceBoundToStorage(100, "EUR")).toBe(100);
    expect(priceBoundToStorage(100, "eur")).toBe(100);
  });

  it("devise inconnue → valeur saisie inchangée", () => {
    expect(priceBoundToStorage(100, "ZZZ")).toBe(100);
  });

  it("XAF → conversion en EUR (50000 FCFA ≈ 76 €)", () => {
    const eur = priceBoundToStorage(50000, "XAF");
    expect(eur).toBeCloseTo(50000 / RATES_FROM_EUR.XAF, 2);
    expect(eur).toBeLessThan(100);
    expect(eur).toBeGreaterThan(70);
  });

  it("aller-retour EUR→XAF→EUR cohérent avec l'affichage", () => {
    // Une chambre à 89 € s'affiche ~58 380 FCFA ; filtrer "max 58 380 FCFA"
    // doit ramener une borne EUR ~89.
    const displayed = convertAmount(89, "EUR", "XAF");
    const back = priceBoundToStorage(displayed, "XAF");
    expect(back).toBeCloseTo(89, 1);
  });
});

describe("validation devise d'affichage (T-135)", () => {
  it("isDisplayCurrency reconnaît les devises connues (insensible casse)", () => {
    expect(isDisplayCurrency("XAF")).toBe(true);
    expect(isDisplayCurrency("xaf")).toBe(true);
    expect(isDisplayCurrency("EUR")).toBe(true);
    expect(isDisplayCurrency("USD")).toBe(true);
    expect(isDisplayCurrency("ZZZ")).toBe(false);
    expect(isDisplayCurrency("")).toBe(false);
    expect(isDisplayCurrency(null)).toBe(false);
    expect(isDisplayCurrency(undefined)).toBe(false);
  });

  it("DISPLAY_CURRENCIES contient les 6 devises du sélecteur de profil", () => {
    for (const c of ["EUR", "USD", "GBP", "CHF", "MAD", "XAF"]) {
      expect(DISPLAY_CURRENCIES).toContain(c);
    }
  });

  it("normalizeDisplayCurrency normalise en majuscules", () => {
    expect(normalizeDisplayCurrency("xaf")).toBe("XAF");
    expect(normalizeDisplayCurrency("eur")).toBe("EUR");
  });

  it("normalizeDisplayCurrency retombe sur le repli si devise absente/inconnue", () => {
    expect(normalizeDisplayCurrency("ZZZ")).toBe("XAF");
    expect(normalizeDisplayCurrency(null)).toBe("XAF");
    expect(normalizeDisplayCurrency(undefined)).toBe("XAF");
    expect(normalizeDisplayCurrency("ZZZ", "EUR")).toBe("EUR");
  });
});

describe("devises zéro-décimales (T-154e / audit n°26, P3-10)", () => {
  it("isZeroDecimalCurrency reconnaît la liste Stripe (XAF, JPY, KRW…)", () => {
    expect(isZeroDecimalCurrency("XAF")).toBe(true);
    expect(isZeroDecimalCurrency("xof")).toBe(true);
    expect(isZeroDecimalCurrency("JPY")).toBe(true);
    expect(isZeroDecimalCurrency("KRW")).toBe(true);
    expect(isZeroDecimalCurrency("VND")).toBe(true);
  });

  it("EUR/USD/GBP/MAD ne sont PAS zéro-décimales", () => {
    for (const c of ["EUR", "USD", "GBP", "MAD"]) {
      expect(isZeroDecimalCurrency(c)).toBe(false);
    }
    expect(isZeroDecimalCurrency(null)).toBe(false);
  });

  it("toMinorUnits : ×100 pour les devises normales, ×1 pour XAF", () => {
    expect(toMinorUnits(100, "EUR")).toBe(10000);
    expect(toMinorUnits(100, "USD")).toBe(10000);
    expect(toMinorUnits(100, "MAD")).toBe(10000);
    expect(toMinorUnits(100000, "XAF")).toBe(100000);
    expect(toMinorUnits(655.957, "XAF")).toBe(656);
  });

  it("formatMoney : XAF sans décimales, EUR inchangé", () => {
    const xaf = formatMoney(50000, "XAF");
    expect(xaf).toMatch(/50[\s\u00a0\u202f]?000/); // pas de « ,00 »
    expect(xaf).not.toMatch(/,00|\u00a000/);
    expect(xaf).toContain("FCFA");
    expect(formatMoney(118.67, "EUR")).toMatch(/118[\s\u00a0\u202f]?[.,]67/);
  });
});
