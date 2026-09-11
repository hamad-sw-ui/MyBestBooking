import { describe, it, expect } from "vitest";
import {
  ANALYTICS_DEFAULT_DAYS,
  ANALYTICS_MAX_DAYS,
  countCivilDays,
  defaultPeriod,
  parseAnalyticsPeriod,
  shiftCivilDays,
} from "./analytics-period";

/**
 * T-241 (F12) — période du tableau de bord.
 *
 * Le point sensible est la **non-régression** : sans paramètre, la période doit
 * rester exactement « 30 derniers jours, comparés aux 30 précédents ». Les
 * dates sont civiles (`YYYY-MM-DD`) : leur calcul ne doit jamais dépendre du
 * fuseau du serveur (T-232).
 */

const TODAY = "2026-09-11";

describe("T-241 — période analytique (dates civiles)", () => {
  it("sans paramètre : 30 derniers jours, comparaison sur la fenêtre précédente", () => {
    const period = defaultPeriod(TODAY);
    expect(period.isDefault).toBe(true);
    expect(period.to).toBe(TODAY);
    expect(period.days).toBe(ANALYTICS_DEFAULT_DAYS);
    expect(period.from).toBe("2026-08-13");
    expect(period.previousTo).toBe("2026-08-12");
    expect(period.previousFrom).toBe("2026-07-14");
    // Les deux fenêtres ont la même longueur : la comparaison est honnête.
    expect(countCivilDays(period.previousFrom, period.previousTo)).toBe(period.days);
  });

  it("accepte une période explicite (bornes incluses)", () => {
    const { period } = parseAnalyticsPeriod("2026-01-01", "2026-01-31", TODAY) as { period: ReturnType<typeof defaultPeriod> };
    expect(period.from).toBe("2026-01-01");
    expect(period.to).toBe("2026-01-31");
    expect(period.days).toBe(31);
    expect(period.isDefault).toBe(false);
    expect(period.previousTo).toBe("2025-12-31");
    expect(period.previousFrom).toBe("2025-12-01");
  });

  it("refuse les périodes invalides (format, dates impossibles, ordre)", () => {
    expect(parseAnalyticsPeriod("2026-13-01", null, TODAY)).toHaveProperty("error");
    expect(parseAnalyticsPeriod("2026-02-30", null, TODAY)).toHaveProperty("error");
    expect(parseAnalyticsPeriod("11/09/2026", null, TODAY)).toHaveProperty("error");
    expect(parseAnalyticsPeriod("2026-09-11", "2026-09-01", TODAY)).toHaveProperty("error");
  });

  it("borne la fenêtre à 366 jours et ramène une fin future à aujourd'hui", () => {
    const { period } = parseAnalyticsPeriod("2000-01-01", "2030-01-01", TODAY) as { period: ReturnType<typeof defaultPeriod> };
    expect(period.to).toBe(TODAY);
    expect(period.days).toBe(ANALYTICS_MAX_DAYS);
  });

  it("calcule les décalages en UTC (aucun jour perdu au changement d'heure)", () => {
    expect(shiftCivilDays("2026-03-29", 1)).toBe("2026-03-30"); // changement d'heure Europe
    expect(shiftCivilDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(shiftCivilDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(countCivilDays("2026-02-27", "2026-03-02")).toBe(4); // année non bissextile
    expect(countCivilDays("2024-02-27", "2024-03-02")).toBe(5); // bissextile
  });
});
