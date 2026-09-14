import { describe, it, expect } from "vitest";
import { countryLabel, travelerTypeLabel } from "./country-label";
import { makeT } from "./ui-strings";

describe("countryLabel", () => {
  it("traduit un code ISO connu", () => {
    const t = makeT("en");
    expect(countryLabel("FR", t)).toBe(t("prop.country.FR"));
  });
  it("traduit les marchés cœur et les pays ajoutés", () => {
    const t = makeT("fr");
    for (const code of ["CM", "SN", "CI", "GA", "ML", "BF", "NE", "TD", "CG", "BE", "NL", "CH", "CA"]) {
      expect(countryLabel(code, t)).toBe(t(`prop.country.${code}` as Parameters<typeof t>[0]));
    }
  });
  it("repli sur le code si inconnu", () => {
    expect(countryLabel("ZZ", makeT("fr"))).toBe("ZZ");
    expect(countryLabel(null, makeT("fr"))).toBe("");
  });
});

describe("travelerTypeLabel", () => {
  it("traduit les types connus, casse insensible", () => {
    const t = makeT("en");
    expect(travelerTypeLabel("couple", t)).toBe(t("review.traveler.couple"));
    expect(travelerTypeLabel("Business", t)).toBe(t("review.traveler.business"));
  });
  it("repli sur la valeur brute si inconnue", () => {
    expect(travelerTypeLabel("unknown", makeT("fr"))).toBe("unknown");
    expect(travelerTypeLabel(null, makeT("fr"))).toBe("");
  });
});
