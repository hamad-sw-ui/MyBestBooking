import { describe, it, expect } from "vitest";
import { countryLabel, travelerTypeLabel } from "./country-label";
import { makeT } from "./ui-strings";

describe("countryLabel", () => {
  it("traduit un code ISO connu", () => {
    const t = makeT("en");
    expect(countryLabel("FR", t)).toBe(t("prop.country.FR"));
  });
  it("repli sur le code si inconnu", () => {
    expect(countryLabel("CM", makeT("fr"))).toBe("CM");
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
