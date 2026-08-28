import { describe, it, expect } from "vitest";
import { pickLocalized, convertAmount, formatMoney, priceBoundToStorage, RATES_FROM_EUR } from "./i18n";

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
