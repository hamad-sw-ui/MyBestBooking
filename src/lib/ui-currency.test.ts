import { describe, it, expect } from "vitest";
import {
  UI_CURRENCY_OPTIONS,
  DISPLAY_CURRENCIES,
  normalizeDisplayCurrency,
  isDisplayCurrency,
} from "./i18n";
import { UI_CURRENCY_STORAGE_KEY } from "./use-display-currency";

/**
 * T-158 (audit n°29) — sélecteur de devise d'affichage public.
 * Garantit : les 4 options du sélecteur sont des devises affichables
 * (conversion serveur possible), la clé localStorage est stable, et la
 * normalisation accepte chacune (aucun cas EUR chiffré modifié).
 */
describe("T-158 — devise d'affichage publique", () => {
  it("expose exactement EUR/USD/GBP/XAF", () => {
    expect([...UI_CURRENCY_OPTIONS]).toEqual(["EUR", "USD", "GBP", "XAF"]);
  });

  it("chaque option est une devise affichable/convertible", () => {
    for (const c of UI_CURRENCY_OPTIONS) {
      expect(isDisplayCurrency(c)).toBe(true);
      expect(DISPLAY_CURRENCIES).toContain(c);
      expect(normalizeDisplayCurrency(c, "XAF")).toBe(c);
    }
  });

  it("clé localStorage stable et distincte de la langue", () => {
    expect(UI_CURRENCY_STORAGE_KEY).toBe("mybb:ui-currency");
    expect(UI_CURRENCY_STORAGE_KEY).not.toBe("mybb:ui-language");
  });

  it("EUR reste numériquement identique (taux 1, aucune conversion)", () => {
    expect(normalizeDisplayCurrency("EUR", "XAF")).toBe("EUR");
    expect(normalizeDisplayCurrency(null, "EUR")).toBe("EUR");
  });
});
