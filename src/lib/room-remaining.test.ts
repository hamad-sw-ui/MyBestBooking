import { describe, expect, it } from "vitest";
import {
  remainingRoomInventory,
  roomPhysicalInventory,
  stayDatesFromPropertyQuery,
} from "./room-remaining";

describe("roomPhysicalInventory", () => {
  it("quantity valide conservée ; défauts défensifs alignés sur le moteur de réservation", () => {
    expect(roomPhysicalInventory(6)).toBe(6);
    expect(roomPhysicalInventory(1)).toBe(1);
    expect(roomPhysicalInventory(null)).toBe(1);
    expect(roomPhysicalInventory(undefined)).toBe(1);
    expect(roomPhysicalInventory(0)).toBe(1); // cohérent avec evaluateBookingRules (quantity ?? 1)
    expect(roomPhysicalInventory(-3)).toBe(1);
    expect(roomPhysicalInventory(2.5)).toBe(1);
  });
});

describe("remainingRoomInventory (règle T-157 : non-annulées consomment l'unité)", () => {
  it("inventaire − chevauchements, plancher à 0", () => {
    expect(remainingRoomInventory(6, 0)).toBe(6);
    expect(remainingRoomInventory(6, 5)).toBe(1);
    expect(remainingRoomInventory(6, 6)).toBe(0);
    expect(remainingRoomInventory(6, 9)).toBe(0); // sur-usage anormal → jamais négatif
    expect(remainingRoomInventory(1, 1)).toBe(0); // chambre unique épuisée
  });
  it("entrées aberrantes côté compteur → traitées comme 0", () => {
    expect(remainingRoomInventory(6, Number.NaN)).toBe(6);
    expect(remainingRoomInventory(6, -2)).toBe(6);
  });
});

describe("stayDatesFromPropertyQuery", () => {
  it("séjour valide → conservé tel quel", () => {
    expect(stayDatesFromPropertyQuery("2026-12-01", "2026-12-04")).toEqual({
      checkIn: "2026-12-01",
      checkOut: "2026-12-04",
    });
  });
  it("absence de dates → pas de calcul de disponibilité (comportement historique)", () => {
    expect(stayDatesFromPropertyQuery(undefined, undefined)).toBeNull();
    expect(stayDatesFromPropertyQuery("2026-12-01", undefined)).toBeNull();
    expect(stayDatesFromPropertyQuery(null, null)).toBeNull();
    expect(stayDatesFromPropertyQuery("", "")).toBeNull();
  });
  it("dates mal formées ou incohérentes → pas de calcul", () => {
    expect(stayDatesFromPropertyQuery("01/12/2026", "2026-12-04")).toBeNull();
    expect(stayDatesFromPropertyQuery("2026-12-04", "2026-12-01")).toBeNull(); // inversées
    expect(stayDatesFromPropertyQuery("2026-12-04", "2026-12-04")).toBeNull(); // nuit nulle
    expect(stayDatesFromPropertyQuery("abc", "def")).toBeNull();
  });
});
