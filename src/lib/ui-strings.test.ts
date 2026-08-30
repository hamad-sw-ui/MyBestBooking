import { describe, it, expect } from "vitest";
import { uiStrings, isUiLocale } from "./ui-strings";

describe("uiStrings (T-132)", () => {
  it("fr par défaut (y compris null/undefined/arabe non supporté)", () => {
    expect(uiStrings(null)["price.from"]).toBe("Dès");
    expect(uiStrings(undefined)["price.perNight"]).toBe("/nuit");
    expect(uiStrings("ar")["book.checkIn"]).toBe("Arrivée"); // retombe en fr
  });

  it("en traduit les libellés", () => {
    expect(uiStrings("en")["price.from"]).toBe("From");
    expect(uiStrings("en")["price.perNight"]).toBe("/night");
    expect(uiStrings("en")["book.seeAvailability"]).toBe("See availability");
    expect(uiStrings("en")["fav.add"]).toBe("Add to favorites");
  });

  it("isUiLocale n'accepte que fr/en", () => {
    expect(isUiLocale("fr")).toBe(true);
    expect(isUiLocale("en")).toBe(true);
    expect(isUiLocale("ar")).toBe(false);
    expect(isUiLocale(null)).toBe(false);
  });

  it("fr et en couvrent exactement les mêmes clés", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });
});
