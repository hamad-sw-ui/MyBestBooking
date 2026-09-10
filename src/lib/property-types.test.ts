import { describe, expect, it } from "vitest";
import { PROPERTY_TYPE_VALUES, isPropertyType, propertyTypeLabel, propertyTypeOptions } from "./property-types";

describe("property-types", () => {
  it("centralise tous les types créables par l'API", () => {
    expect(PROPERTY_TYPE_VALUES).toEqual([
      "hotel",
      "apartment",
      "house",
      "villa",
      "hostel",
      "resort",
      "bnb",
      "guesthouse",
      "riad",
      "camping",
    ]);
    expect(isPropertyType("house")).toBe(true);
    expect(isPropertyType("unknown")).toBe(false);
  });

  it("fournit les labels FR/EN et les options UI sans liste divergente", () => {
    expect(propertyTypeLabel("house", "fr")).toBe("Maison");
    expect(propertyTypeLabel("house", "en")).toBe("House");
    expect(propertyTypeLabel("unknown", "fr")).toBe("unknown");

    const options = propertyTypeOptions((key) => key);
    expect(options).toHaveLength(PROPERTY_TYPE_VALUES.length);
    expect(options.map((option) => option.value)).toEqual([...PROPERTY_TYPE_VALUES]);
    expect(options.find((option) => option.value === "camping")?.label).toBe("prop.type.camping");
  });
});
