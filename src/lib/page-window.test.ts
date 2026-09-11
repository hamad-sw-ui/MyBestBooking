import { describe, expect, it } from "vitest";
import {
  API_PAGE_DEFAULT,
  API_PAGE_MAX,
  WINDOW_MAX,
  WINDOW_STEP,
  nextWindowSize,
  parseApiPagination,
  parsePageWindow,
} from "./page-window";

/**
 * T-245 (audit n°5, A2) — bornes de la fenêtre d'affichage (écrans) et de la
 * pagination **opt-in** des API. Le point critique : sans paramètre, l'API doit
 * se comporter exactement comme avant (`pagination === null`).
 */

describe("parsePageWindow (écrans RSC)", () => {
  it("sans paramètre ou valeur invalide → fenêtre par défaut", () => {
    expect(parsePageWindow(undefined)).toMatchObject({ size: WINDOW_STEP, offset: 0, atMax: false });
    expect(parsePageWindow("")).toMatchObject({ size: WINDOW_STEP });
    expect(parsePageWindow("abc")).toMatchObject({ size: WINDOW_STEP });
    expect(parsePageWindow("0")).toMatchObject({ size: WINDOW_STEP });
    expect(parsePageWindow("-40")).toMatchObject({ size: WINDOW_STEP });
  });

  it("valeur explicite plus petite que le pas → pas minimum (pas de fenêtre ridicule)", () => {
    expect(parsePageWindow("5")).toMatchObject({ size: WINDOW_STEP, queryLimit: WINDOW_STEP + 1 });
  });

  it("valeur explicite → taille demandée, et la requête lit une ligne de plus", () => {
    expect(parsePageWindow("50")).toMatchObject({ size: 50, queryLimit: 51, offset: 0 });
  });

  it("valeur au-delà du plafond → bornée et signalée", () => {
    expect(parsePageWindow("999999")).toMatchObject({ size: WINDOW_MAX, atMax: true });
  });

  it("accepte un paramètre répété (tableau) en prenant la première valeur", () => {
    expect(parsePageWindow(["75", "10"])).toMatchObject({ size: 75 });
  });
});

describe("nextWindowSize", () => {
  it("avance d'un pas et s'arrête au plafond", () => {
    expect(nextWindowSize(25)).toBe(50);
    expect(nextWindowSize(WINDOW_MAX - 5)).toBe(WINDOW_MAX);
    expect(nextWindowSize(WINDOW_MAX)).toBe(WINDOW_MAX);
  });
});

describe("parseApiPagination (opt-in)", () => {
  const sp = (qs: string) => new URLSearchParams(qs);

  it("aucun paramètre → pas de pagination (réponse historique)", () => {
    expect(parseApiPagination(sp(""))).toEqual({ pagination: null, error: null });
    expect(parseApiPagination(sp("status=confirmed"))).toEqual({ pagination: null, error: null });
  });

  it("limit seul → offset implicite à 0", () => {
    expect(parseApiPagination(sp("limit=5"))).toEqual({
      pagination: { limit: 5, offset: 0 },
      error: null,
    });
  });

  it("offset seul → limite par défaut", () => {
    expect(parseApiPagination(sp("offset=40"))).toEqual({
      pagination: { limit: API_PAGE_DEFAULT, offset: 40 },
      error: null,
    });
  });

  it("valeurs invalides → message d'erreur (400), pas de pagination silencieuse", () => {
    expect(parseApiPagination(sp("limit=0")).error).toBeTruthy();
    expect(parseApiPagination(sp("limit=-3")).error).toBeTruthy();
    expect(parseApiPagination(sp("limit=abc")).error).toBeTruthy();
    expect(parseApiPagination(sp("offset=-1")).error).toBeTruthy();
    expect(parseApiPagination(sp("offset=1.5")).error).toBeTruthy();
  });

  it("limite supérieure bornée au plafond de l'API", () => {
    expect(parseApiPagination(sp("limit=1000")).pagination).toEqual({
      limit: API_PAGE_MAX,
      offset: 0,
    });
  });
});
