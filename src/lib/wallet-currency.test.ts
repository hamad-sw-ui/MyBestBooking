import { describe, it, expect } from "vitest";
import { applyWalletToTotal } from "./wallet-currency";

/**
 * T-153 (audit n°25, A) — Le wallet est libellé EUR ; application à un
 * total libellé dans la devise de la chambre via les taux figés
 * RATES_FROM_EUR (jamais 1:1 entre devises). EUR = identité stricte
 * (non-régression).
 */
describe("applyWalletToTotal (T-153, A)", () => {
  it("EUR : identité stricte (wallet 25 € sur 100 €)", () => {
    expect(applyWalletToTotal(25, 100, "EUR")).toEqual({
      walletUsed: 25,
      walletUsedEur: 25,
      totalAfter: 75,
    });
  });

  it("EUR : wallet plafonné au total (wallet 200 € sur 100 €)", () => {
    expect(applyWalletToTotal(200, 100, "EUR")).toEqual({
      walletUsed: 100,
      walletUsedEur: 100,
      totalAfter: 0,
    });
  });

  it("USD : convertit 25 € en 27,00 $ et débite le wallet en EUR", () => {
    // 1 EUR = 1,08 USD (taux figé i18n) : 25 € → 27,00 $ ; débit réel 25,00 €.
    expect(applyWalletToTotal(25, 220, "USD")).toEqual({
      walletUsed: 27,
      walletUsedEur: 25,
      totalAfter: 193,
    });
  });

  it("USD : wallet supérieur au total → débit partiel en EUR uniquement", () => {
    // 50 € → 54,00 $ ; le total est 27,00 $ → seuls 25,00 € sont débités.
    expect(applyWalletToTotal(50, 27, "USD")).toEqual({
      walletUsed: 27,
      walletUsedEur: 25,
      totalAfter: 0,
    });
  });

  it("GBP : respecte le taux (10 € → 8,50 £)", () => {
    expect(applyWalletToTotal(10, 100, "GBP")).toEqual({
      walletUsed: 8.5,
      walletUsedEur: 10,
      totalAfter: 91.5,
    });
  });

  it("wallet à 0 ou négatif → aucun débit, total inchangé", () => {
    expect(applyWalletToTotal(0, 100, "USD")).toEqual({
      walletUsed: 0,
      walletUsedEur: 0,
      totalAfter: 100,
    });
    expect(applyWalletToTotal(-5, 100, "USD")).toEqual({
      walletUsed: 0,
      walletUsedEur: 0,
      totalAfter: 100,
    });
  });

  it("devise inconnue → erreur explicite, aucun débit 1:1", () => {
    const r = applyWalletToTotal(25, 100, "XYZ");
    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toContain("Devise non supportée");
  });

  it("devise absente → EUR (identité)", () => {
    expect(applyWalletToTotal(25, 100, "")).toEqual({
      walletUsed: 25,
      walletUsedEur: 25,
      totalAfter: 75,
    });
  });
});
