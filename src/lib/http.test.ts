import { describe, it, expect } from "vitest";
import { isUuid } from "./http";

describe("isUuid (T-122 / G1)", () => {
  it("accepte un UUID v4 standard", () => {
    expect(isUuid("070fa68a-de20-4031-a70c-c89879e35ed2")).toBe(true);
    expect(isUuid("ea635625-5911-4963-b5f3-4292e791b399")).toBe(true);
  });

  it("accepte le UUID nil (valide syntaxiquement, géré comme 404 en aval)", () => {
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("accepte majuscules", () => {
    expect(isUuid("070FA68A-DE20-4031-A70C-C89879E35ED2")).toBe(true);
  });

  it("rejette une chaîne courte / non UUID", () => {
    expect(isUuid("abc")).toBe(false);
    expect(isUuid("xyz")).toBe(false);
  });

  it("rejette un UUID tronqué ou avec séparateurs manquants", () => {
    expect(isUuid("070fa68ade204031a70cc89879e35ed2")).toBe(false);
    expect(isUuid("070fa68a-de20-4031-a70c-c89879e35ed")).toBe(false);
  });

  it("rejette des valeurs non chaîne", () => {
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid({})).toBe(false);
  });
});
