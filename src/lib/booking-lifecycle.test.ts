import { describe, expect, it } from "vitest";
import { isReviewEligible, transitionError } from "./booking-lifecycle";

describe("booking lifecycle", () => {
  it("empêche le voyageur de clôturer une réservation future", () => {
    expect(transitionError({
      current: "confirmed",
      next: "completed",
      actor: "customer",
      checkOut: "2027-10-12",
      today: "2026-08-23",
    })).toMatch(/uniquement annuler/);
  });

  it("autorise l'hôte à clôturer uniquement après le départ", () => {
    expect(transitionError({
      current: "confirmed",
      next: "completed",
      actor: "host",
      checkOut: "2027-10-12",
      today: "2026-08-23",
    })).toMatch(/après la date/);
    expect(transitionError({
      current: "confirmed",
      next: "completed",
      actor: "host",
      checkOut: "2026-08-22",
      today: "2026-08-23",
    })).toBeNull();
  });

  it("conditionne l'avis à un séjour réellement terminé", () => {
    expect(isReviewEligible("completed", "2026-08-22", "2026-08-23")).toBe(true);
    expect(isReviewEligible("completed", "2027-08-22", "2026-08-23")).toBe(false);
    expect(isReviewEligible("confirmed", "2026-08-22", "2026-08-23")).toBe(false);
  });
});
