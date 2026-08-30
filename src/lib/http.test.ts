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

import { z } from "zod";
import { frenchZodMessage } from "./http";

describe("frenchZodMessage (T-137 / A1)", () => {
  it("traduit en français un message Zod anglais par défaut (nombre trop petit)", () => {
    const schema = z.object({ numAdults: z.number().int().min(1) });
    const result = schema.safeParse({ numAdults: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = frenchZodMessage(result.error);
      expect(msg).toBe("Valeur trop petite");
      expect(msg).not.toMatch(/Too small/i);
    }
  });

  it("traduit une note hors bornes (trop grande)", () => {
    const schema = z.object({ overallRating: z.number().min(1).max(10) });
    const result = schema.safeParse({ overallRating: 99 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(frenchZodMessage(result.error)).toBe("Valeur trop grande");
    }
  });

  it("traduit un email invalide", () => {
    const schema = z.object({ guestEmail: z.string().email() });
    const result = schema.safeParse({ guestEmail: "pasunemail" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(frenchZodMessage(result.error)).toBe("Adresse email invalide");
    }
  });

  it("préserve un message personnalisé déjà rédigé en français", () => {
    const schema = z.object({
      password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    });
    const result = schema.safeParse({ password: "court" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(frenchZodMessage(result.error)).toBe(
        "Le mot de passe doit contenir au moins 8 caractères",
      );
    }
  });

  it("gère un objet sans erreurs (repli générique)", () => {
    expect(frenchZodMessage({ issues: [] })).toBe("Paramètres invalides");
  });
});

describe("frenchZodMessage (T-138 / A1 — extension)", () => {
  it("traduit un UUID invalide (propertyId mal formé)", () => {
    const schema = z.object({ propertyId: z.string().uuid() });
    const result = schema.safeParse({ propertyId: "pas-un-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(frenchZodMessage(result.error)).toBe("Identifiant invalide");
    }
  });

  it("traduit un texte vide en champ requis (message/conversation)", () => {
    const schema = z.object({ content: z.string().min(1).max(4000) });
    const result = schema.safeParse({ content: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = frenchZodMessage(result.error);
      expect(msg).toBe("Ce champ est requis");
      expect(msg).not.toMatch(/Too small/i);
    }
  });
});
