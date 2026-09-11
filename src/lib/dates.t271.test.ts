import { describe, it, expect } from "vitest";
import { formatTimestamp } from "./dates";
import { formatDate } from "./utils";

/**
 * T-271 (audit n°8, F1) — styles Intl exclusifs des composants.
 *
 * Constat reproduit par l'audit à l'exécution : `/mes-reservations` rendait
 * 500 pour tout client possédant une demande `pending` — le champ
 * `requestExpiresAt` (toujours posé par `POST /api/bookings`) passait dans
 * `formatDate(…, { dateStyle: "medium", timeStyle: "short" })` →
 * `formatTimestamp` mélangeait styles et composants → `RangeError:
 * Invalid option` (ECMA-402 interdit la combinaison).
 *
 * Contrat verrouillé ici :
 *  1. styles → pas d'exception, rendu selon les styles demandés (FR exact) ;
 *  2. composants seuls → rendu strictement identique au chemin historique ;
 *  3. date civile + styles → même règle (branche `formatCivilDate`) ;
 *  4. valeurs nulles/invalides → « — » (inchangé).
 */
describe("T-271 — formatTimestamp : styles Intl sans composants", () => {
  it("un timestamp + { dateStyle, timeStyle } ne lève plus (le 500 de l'audit)", () => {
    // Le cas exact de mes-reservations/page.tsx:229 (requestExpiresAt).
    const rendered = formatTimestamp("2027-04-05T12:00:00.000Z", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
    expect(rendered).toBe("5 avr. 2027, 12:00");
  });

  it("timeStyle seul : l'instant reste dans le fuseau demandé (jamais le runtime)", () => {
    // 23:30 UTC le 5 avril — le jour ne doit pas glisser au 6 avril.
    expect(formatTimestamp("2027-04-05T23:30:00.000Z", { timeStyle: "short", timeZone: "UTC" })).toBe(
      "23:30",
    );
  });

  it("composants seuls : rendu strictement inchangé (non-régression)", () => {
    // Chemin historique : défauts day/month/year/hour/minute + spread.
    expect(
      formatTimestamp("2027-04-05T12:00:00.000Z", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }),
    ).toBe("5 avr. 2027, 12:00");
  });

  it("aucune option : rendu par défaut inchangé", () => {
    expect(formatTimestamp(new Date("2027-04-05T12:00:00.000Z"), undefined, "fr-FR")).toBe(
      "5 avril 2027 à 12:00",
    );
  });

  it("EN : styles → rendu EN (localisation conservée dans la branche styles)", () => {
    expect(
      formatTimestamp("2027-04-05T12:00:00.000Z", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }, "en-GB"),
    ).toBe("5 Apr 2027, 12:00");
  });

  it("formatDate : date civile + styles → branche formatCivilDate, sans exception", () => {
    // Avant T-271, le même mélange styles/composants existait dans
    // formatCivilDate (le pré-merge de formatDate passait les styles bruts).
    expect(formatDate("2027-04-05", { dateStyle: "medium" })).toBe("5 avr. 2027");
    // Composants seuls : rendu inchangé.
    expect(formatDate("2027-04-05", { day: "numeric", month: "long", year: "numeric" })).toBe(
      "5 avril 2027",
    );
  });

  it("formatDate : timestamp + styles → le cas exact du call site (pas d'exception)", () => {
    expect(
      formatDate("2027-04-05T12:00:00.000Z", { dateStyle: "medium", timeStyle: "short" }),
    ).toBe("5 avr. 2027, 12:00");
  });

  it("valeur nulle ou invalide : « — » (inchangé)", () => {
    expect(formatTimestamp(null, { dateStyle: "medium" })).toBe("—");
    expect(formatTimestamp("pas-une-date", { timeStyle: "short" })).toBe("—");
  });
});
