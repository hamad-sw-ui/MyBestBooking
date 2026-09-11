import { describe, it, expect } from "vitest";
import { coordinateField, displayCoordinate, isCoordinate } from "./coordinates";

/**
 * T-259 (audit n°6, B6) — coordonnées d'hébergement : bornes, virgule
 * décimale française et affichage (PostgreSQL rend un `decimal(10,8)` :
 * « 43.76900000 » ne doit pas s'afficher tel quel dans un champ de saisie).
 */
describe("coordinates (T-259)", () => {
  it("displayCoordinate retire les zéros inutiles", () => {
    expect(displayCoordinate("43.76900000")).toBe("43.769");
    expect(displayCoordinate("48.86060000")).toBe("48.8606");
    expect(displayCoordinate("-0.50000000")).toBe("-0.5");
    expect(displayCoordinate("123")).toBe("123");
    expect(displayCoordinate(null)).toBe("");
    expect(displayCoordinate(undefined)).toBe("");
    // Une valeur non numérique est rendue telle quelle (jamais « NaN »).
    expect(displayCoordinate("abc")).toBe("abc");
  });

  it("isCoordinate n'accepte que l'intervalle attendu et tolère la virgule", () => {
    expect(isCoordinate("43,769", "latitude")).toBe(true);
    expect(isCoordinate("-90", "latitude")).toBe(true);
    expect(isCoordinate("90", "latitude")).toBe(true);
    expect(isCoordinate("90.0001", "latitude")).toBe(false);
    expect(isCoordinate("abc", "latitude")).toBe(false);
    expect(isCoordinate("", "latitude")).toBe(false);
    expect(isCoordinate("179,9", "longitude")).toBe(true);
    expect(isCoordinate("-180", "longitude")).toBe(true);
    expect(isCoordinate("-180.5", "longitude")).toBe(false);
  });

  it("coordinateField normalise et efface (chaîne vide ⇒ null)", () => {
    expect(coordinateField("latitude").parse("43,769")).toBe("43.769");
    expect(coordinateField("longitude").parse("11.2558")).toBe("11.2558");
    expect(coordinateField("latitude").parse("")).toBeNull();
    expect(() => coordinateField("latitude").parse("91")).toThrow();
    expect(() => coordinateField("longitude").parse("-181")).toThrow();
    expect(() => coordinateField("latitude").parse("Nord")).toThrow();
    // Champ facultatif : absent ⇒ undefined (le PUT reste partiel).
    expect(coordinateField("latitude").parse(undefined)).toBeUndefined();
  });
});
