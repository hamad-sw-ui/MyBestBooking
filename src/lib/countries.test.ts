import { describe, expect, it } from "vitest";
import { SUPPORTED_COUNTRIES, countryOptions, isSupportedCountry } from "./countries";

describe("countries", () => {
  it("centralise les pays proposés dans les formulaires", () => {
    expect(SUPPORTED_COUNTRIES).toContain("FR");
    expect(SUPPORTED_COUNTRIES).toContain("US");
    expect(isSupportedCountry("GB")).toBe(true);
    expect(isSupportedCountry("ZZ")).toBe(false);
  });

  it("produit des options traduites via les clés UI", () => {
    const options = countryOptions((key) => key);
    expect(options.map((option) => option.value)).toEqual([...SUPPORTED_COUNTRIES]);
    expect(options.find((option) => option.value === "MA")?.label).toBe("prop.country.MA");
  });
});
