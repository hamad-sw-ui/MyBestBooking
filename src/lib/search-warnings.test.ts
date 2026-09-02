import { describe, it, expect } from "vitest";
import {
  searchFilterWarnings,
  SEARCH_WARNING_KEY,
  type SearchWarning,
} from "./search-warnings";
import { uiStrings, type UiStringKey } from "./ui-strings";

/** T-175 — règles de détection des filtres ignorés/incohérents. */

const FUTURE_IN = "2027-05-10";
const FUTURE_OUT = "2027-05-12";

describe("searchFilterWarnings (T-175)", () => {
  it("ne signale rien pour des paramètres absents ou sains", () => {
    expect(searchFilterWarnings({})).toEqual([]);
    expect(
      searchFilterWarnings({
        checkIn: FUTURE_IN,
        checkOut: FUTURE_OUT,
        minPrice: "100",
        maxPrice: "500",
        guests: "2",
      }),
    ).toEqual([]);
  });

  it("dates inversées, mal formées ou incomplètes → datesIgnored", () => {
    expect(
      searchFilterWarnings({ checkIn: FUTURE_OUT, checkOut: FUTURE_IN }),
    ).toContain("datesIgnored");
    expect(
      searchFilterWarnings({ checkIn: "10/05/2027", checkOut: FUTURE_OUT }),
    ).toContain("datesIgnored");
    expect(searchFilterWarnings({ checkIn: FUTURE_IN })).toContain("datesIgnored");
    expect(searchFilterWarnings({ checkOut: FUTURE_OUT })).toContain("datesIgnored");
    // Égale arrivée = départ (séjour de 0 nuit) : ignoré par validStay
    expect(
      searchFilterWarnings({ checkIn: FUTURE_IN, checkOut: FUTURE_IN }),
    ).toContain("datesIgnored");
  });

  it("séjour entièrement passé → pastDates (et pas datesIgnored)", () => {
    const w = searchFilterWarnings({ checkIn: "2020-01-01", checkOut: "2020-01-03" });
    expect(w).toEqual(["pastDates"]);
  });

  it("bornes de prix inversées → priceInverted (EUR et devise affichée)", () => {
    expect(
      searchFilterWarnings({ minPrice: "500", maxPrice: "100" }),
    ).toEqual(["priceInverted"]);
    // Même cas via une devise d'affichage (comparaison en devise stockage).
    expect(
      searchFilterWarnings({ minPrice: "50000", maxPrice: "10000", displayCurrency: "XAF" }),
    ).toEqual(["priceInverted"]);
    expect(
      searchFilterWarnings({ minPrice: "100", maxPrice: "500" }),
    ).toEqual([]);
  });

  it("guests non entier/négatif → guestsIgnored ; entier positif → rien", () => {
    expect(searchFilterWarnings({ guests: "abc" })).toEqual(["guestsIgnored"]);
    expect(searchFilterWarnings({ guests: "2.5" })).toEqual(["guestsIgnored"]);
    expect(searchFilterWarnings({ guests: "0" })).toEqual(["guestsIgnored"]);
    expect(searchFilterWarnings({ guests: "-3" })).toEqual(["guestsIgnored"]);
    expect(searchFilterWarnings({ guests: "4" })).toEqual([]);
  });

  it("cumule plusieurs avertissements", () => {
    const w = searchFilterWarnings({
      checkIn: "2020-01-03",
      checkOut: "2020-01-01",
      minPrice: "900",
      maxPrice: "10",
      guests: "x",
    });
    expect(w).toEqual(
      expect.arrayContaining(["datesIgnored", "priceInverted", "guestsIgnored"]),
    );
    expect(w).toHaveLength(3);
  });

  it("chaque warning possède une clé de dictionnaire FR et EN renseignée", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    for (const w of Object.keys(SEARCH_WARNING_KEY) as SearchWarning[]) {
      const key: UiStringKey = SEARCH_WARNING_KEY[w];
      expect(fr[key].length).toBeGreaterThan(10);
      expect(en[key].length).toBeGreaterThan(10);
      expect(fr[key]).not.toBe(en[key]); // réellement traduit
    }
  });
});
