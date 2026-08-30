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

  it("T-153 (C) : total USD converti en EUR avant cashback (jamais 1:1)", () => {
    // 200 $ / 1,08 = 185,19 € → 5 % = 9,26 € crédités au wallet EUR.
    expect(calculateLoyaltyAward(
      { bookingsCount: 20, level: 3, walletBalance: "10.00" },
      200,
      [5, 15],
      "USD",
    )).toEqual({ bookingsCount: 21, level: 3, cashback: 9.26, walletBalance: "19.26" });
  });

  it("T-153 (C) : devise inconnue → total traité tel quel (historique)", () => {
    expect(calculateLoyaltyAward(
      { bookingsCount: 20, level: 3, walletBalance: "0" },
      100,
      [5, 15],
      "XYZ",
    )).toEqual({ bookingsCount: 21, level: 3, cashback: 5, walletBalance: "5.00" });
  });

  it("T-153 (C) : EUR explicite = identique à l'appel 3 args (non-régression)", () => {
    const withCurrency = calculateLoyaltyAward(
      { bookingsCount: 20, level: 3, walletBalance: "10.00" },
      149.99,
      [5, 15],
      "EUR",
    );
    const legacy = calculateLoyaltyAward(
      { bookingsCount: 20, level: 3, walletBalance: "10.00" },
      149.99,
      [5, 15],
    );
    expect(withCurrency).toEqual(legacy);
  });
});
