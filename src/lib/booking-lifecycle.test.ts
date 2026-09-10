import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  isReviewEligible,
  transitionError,
  type BookingActor,
  type BookingStatus,
} from "./booking-lifecycle";

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

/**
 * T-216 — la colonne Statut de /dashboard/bookings ne propose que les
 * transitions que le serveur accepterait (`transitionError` + garde paiement).
 */
describe("availableTransitions (T-216)", () => {
  const TODAY = "2026-09-10";
  const PAST = "2026-08-01";
  const FUTURE = "2026-12-01";

  function transitions(
    current: BookingStatus,
    actor: BookingActor,
    opts: { checkOut?: string; paymentStatus?: string | null } = {},
  ) {
    return availableTransitions({
      current,
      actor,
      checkOut: opts.checkOut ?? PAST,
      paymentStatus: opts.paymentStatus ?? "paid",
      today: TODAY,
    });
  }

  it("hôte : demande en attente → confirmer ou annuler", () => {
    expect(transitions("pending", "host")).toEqual(["confirmed", "cancelled"]);
  });

  it("admin : mêmes transitions que l'hôte", () => {
    expect(transitions("pending", "admin")).toEqual(["confirmed", "cancelled"]);
    expect(transitions("confirmed", "admin", { checkOut: PAST })).toEqual([
      "cancelled",
      "completed",
      "no_show",
    ]);
  });

  it("hôte : séjour payé et passé → clôturer ou no-show", () => {
    expect(transitions("confirmed", "host", { checkOut: PAST })).toEqual([
      "cancelled",
      "completed",
      "no_show",
    ]);
  });

  it("hôte : séjour en cours (départ futur) → seule l'annulation reste possible", () => {
    expect(transitions("confirmed", "host", { checkOut: FUTURE })).toEqual(["cancelled"]);
  });

  it("garde paiement : pas de clôture tant que le règlement n'est pas constaté", () => {
    expect(transitions("confirmed", "host", { checkOut: PAST, paymentStatus: "pending" })).toEqual([
      "cancelled",
      "no_show",
    ]);
    expect(transitions("confirmed", "admin", { checkOut: PAST, paymentStatus: "refunded" })).toEqual([
      "cancelled",
      "no_show",
    ]);
  });

  it("voyageur : uniquement l'annulation, jamais la clôture", () => {
    expect(transitions("pending", "customer", { checkOut: FUTURE })).toEqual(["cancelled"]);
    expect(transitions("confirmed", "customer", { checkOut: PAST })).toEqual(["cancelled"]);
  });

  it("états terminaux : aucune transition proposable", () => {
    for (const terminal of ["cancelled", "completed", "no_show"] as BookingStatus[]) {
      expect(transitions(terminal, "host")).toEqual([]);
      expect(transitions(terminal, "admin")).toEqual([]);
      expect(transitions(terminal, "customer")).toEqual([]);
    }
  });

  it("ne propose jamais une transition que transitionError refuse", () => {
    const statuses: BookingStatus[] = ["pending", "confirmed", "cancelled", "completed", "no_show"];
    const actors: BookingActor[] = ["customer", "host", "admin", "system"];
    for (const current of statuses) {
      for (const actor of actors) {
        for (const checkOut of [PAST, FUTURE]) {
          for (const paymentStatus of ["paid", "pending", null]) {
            for (const next of availableTransitions({ current, actor, checkOut, paymentStatus, today: TODAY })) {
              expect(
                transitionError({ current, next, actor, checkOut, today: TODAY }),
              ).toBeNull();
            }
          }
        }
      }
    }
  });
});
