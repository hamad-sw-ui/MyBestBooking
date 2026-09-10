import { describe, it, expect, afterAll } from "vitest";
import {
  addCivilDays,
  civilDateOf,
  civilDaysBetween,
  civilToday,
  formatCivilDate,
  formatTimestamp,
  toCivilDate,
} from "./dates";

/**
 * T-232 (audit n°3, F1/F10) — dates civiles et fuseaux.
 *
 * Constat reproduit par l'audit : le même séjour s'affichait « 24 septembre » sur
 * un serveur en UTC et « 23 septembre » côté navigateur à Los Angeles, et `pg`
 * lisait une colonne `date` à minuit **local du serveur** (`TZ=Africa/Douala` →
 * `2026-09-23T23:00Z`), rendant `toDate()` et la clôture des séjours dépendantes
 * du fuseau de l'instance.
 *
 * Ces tests s'exécutent **sous plusieurs fuseaux** : le résultat des helpers ne
 * doit jamais en dépendre.
 */

const originalTz = process.env.TZ;
afterAll(() => {
  process.env.TZ = originalTz;
});

/** Exécute une assertion sous un fuseau donné (Node applique `process.env.TZ`). */
function underTimeZone(tz: string, fn: () => void) {
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    process.env.TZ = originalTz;
  }
}

describe("T-232 — dates civiles (jamais décalées)", () => {
  it("affiche la même date civile sous UTC, Douala, Los Angeles et Kiritimati", () => {
    for (const tz of ["UTC", "Africa/Douala", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      underTimeZone(tz, () => {
        expect(process.env.TZ).toBe(tz);
        expect(formatCivilDate("2026-09-24")).toBe("24 septembre 2026");
        expect(formatCivilDate("2026-01-01")).toBe("1 janvier 2026");
        // Défauts surchargeables : `year: undefined` retire l'année héritée.
        expect(formatCivilDate("2026-09-24", { day: "numeric", month: "short" })).toBe("24 sept. 2026");
        expect(
          formatCivilDate("2026-09-24", { day: "numeric", month: "short", year: undefined }),
        ).toBe("24 sept.");
        expect(formatCivilDate("2026-09-24", undefined, "en")).toBe("24 September 2026");
      });
    }
  });

  it("normalise une colonne `date` lue à minuit local (le cas pg)", () => {
    // Reproductions exactes du bug : la même date civile, lue par pg sous deux
    // fuseaux serveur, donne deux instants différents.
    expect(toCivilDate("2026-09-24T07:00:00.000Z")).toBe("2026-09-24"); // TZ=America/Los_Angeles
    // TZ=Africa/Douala : minuit local = 23:00Z la veille.
    expect(toCivilDate("2026-09-23T23:00:00.000Z")).toBe("2026-09-23");
    // Une chaîne `YYYY-MM-DD` est déjà une date civile : rendue telle quelle.
    expect(toCivilDate("2026-09-24")).toBe("2026-09-24");
    expect(toCivilDate("")).toBeNull();
    expect(toCivilDate(null)).toBeNull();
    expect(toCivilDate(undefined)).toBeNull();
    expect(toCivilDate("pas-une-date")).toBeNull();
    expect(toCivilDate(new Date(Number.NaN))).toBeNull();
  });

  it("formate un instant dans un fuseau explicite, jamais celui du runtime", () => {
    const instant = new Date("2026-09-24T23:30:00.000Z");
    underTimeZone("Africa/Douala", () => {
      // 23:30Z le 24 → 25 septembre à Paris/Douala, 24 septembre en UTC.
      expect(formatTimestamp(instant, { timeZone: "UTC" })).toContain("24 septembre");
      expect(formatTimestamp(instant, { timeZone: "Europe/Paris" })).toContain("25 septembre");
      // Sans fuseau fourni : UTC par défaut (déterministe, pas le runtime).
      expect(formatTimestamp(instant)).toContain("24 septembre");
    });
    underTimeZone("America/Los_Angeles", () => {
      expect(formatTimestamp(instant, { timeZone: "America/Los_Angeles" })).toContain("24 septembre");
    });
  });

  it("calcule « aujourd'hui » dans un fuseau explicite", () => {
    // 1er janvier 2026 à 00:30 UTC : encore le 31 décembre à Los Angeles,
    // déjà le 1er janvier à Kiritimati (+14).
    const now = new Date("2026-01-01T00:30:00.000Z");
    expect(civilToday("UTC", now)).toBe("2026-01-01");
    expect(civilToday("America/Los_Angeles", now)).toBe("2025-12-31");
    expect(civilToday("Pacific/Kiritimati", now)).toBe("2026-01-01");
    expect(civilToday("Africa/Douala", now)).toBe("2026-01-01");
    // L'horizon ne dépend pas du fuseau du runtime : on le prouve en changeant TZ.
    underTimeZone("America/Los_Angeles", () => {
      expect(civilToday("UTC", now)).toBe("2026-01-01");
    });
  });

  it("civilDateOf rend la date locale d'un instant dans le fuseau demandé", () => {
    const instant = new Date("2026-09-24T02:00:00.000Z");
    expect(civilDateOf(instant, "UTC")).toBe("2026-09-24");
    expect(civilDateOf(instant, "America/Los_Angeles")).toBe("2026-09-23");
    expect(civilDateOf(instant, "Pacific/Kiritimati")).toBe("2026-09-24");
    expect(civilDateOf(instant, "Africa/Douala")).toBe("2026-09-24");
  });

  it("arithmétique de dates civiles (sans dérive de fuseau)", () => {
    underTimeZone("America/Los_Angeles", () => {
      expect(addCivilDays("2026-09-24", 1)).toBe("2026-09-25");
      expect(addCivilDays("2026-09-01", -1)).toBe("2026-08-31");
      expect(addCivilDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(civilDaysBetween("2026-09-24", "2026-09-27")).toBe(3);
      expect(civilDaysBetween("2026-09-27", "2026-09-24")).toBe(-3);
      expect(civilDaysBetween("2026-02-28", "2026-03-01")).toBe(1);
    });
  });

  it("un séjour [24 → 27] reste 3 nuits quel que soit le fuseau du runtime", () => {
    for (const tz of ["UTC", "Africa/Douala", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      underTimeZone(tz, () => {
        expect(civilDaysBetween(toCivilDate("2026-09-24")!, toCivilDate("2026-09-27")!)).toBe(3);
      });
    }
  });
});
