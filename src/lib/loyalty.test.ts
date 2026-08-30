import { describe, expect, it } from "vitest";
import { calculateLoyaltyAward } from "./loyalty";

describe("calculateLoyaltyAward", () => {
  it("incrémente le compteur seulement à la clôture et franchit les seuils", () => {
    expect(calculateLoyaltyAward(
      { bookingsCount: 4, level: 1, walletBalance: "0" },
      100,
      [5, 15],
    )).toEqual({ bookingsCount: 5, level: 2, cashback: 0, walletBalance: "0.00" });
  });

  it("crédite 5 % pour un Ambassador déjà acquis", () => {
    expect(calculateLoyaltyAward(
      { bookingsCount: 20, level: 3, walletBalance: "10.00" },
      149.99,
      [5, 15],
    )).toEqual({ bookingsCount: 21, level: 3, cashback: 7.5, walletBalance: "17.50" });
  });
});
