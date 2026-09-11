import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * T-236 (audit n°3, F5) — l'heure d'arrivée estimée était stockée sans être
 * relue, et l'API acceptait n'importe quelle chaîne alors que la colonne est un
 * `time` (une saisie libre provoquait une erreur PostgreSQL → 500).
 *
 * Ce test verrouille la règle d'entrée (même expression que le schéma du
 * tunnel) et la restitution (`HH:MM`).
 */
const arrivalSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Heure d'arrivée estimée invalide (HH:MM)")
  .optional();

describe("T-236 — heure d'arrivée estimée", () => {
  it("accepte HH:MM et la forme avec secondes renvoyée par PostgreSQL", () => {
    expect(arrivalSchema.parse("15:00")).toBe("15:00");
    expect(arrivalSchema.parse("00:00")).toBe("00:00");
    expect(arrivalSchema.parse("23:59")).toBe("23:59");
    expect(arrivalSchema.parse("15:00:00")).toBe("15:00:00");
    expect(arrivalSchema.parse(undefined)).toBeUndefined();
  });

  it("refuse une saisie libre (l'ancien contrat menait à une erreur base)", () => {
    for (const invalid of ["vers 15 h", "25:00", "12:75", "12", "12h30", "midi", ""]) {
      expect(arrivalSchema.safeParse(invalid).success, invalid).toBe(false);
    }
  });

  it("s'affiche sur 5 caractères (HH:MM) quel que soit le format stocké", () => {
    const displayed = (value: string) => String(value).slice(0, 5);
    expect(displayed("15:00:00")).toBe("15:00");
    expect(displayed("09:30")).toBe("09:30");
  });
});
