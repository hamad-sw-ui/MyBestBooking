import { describe, it, expect } from "vitest";
import {
  calculateReferralReward,
  generateReferralCode,
  normalizeReferralCode,
} from "./referral";

/**
 * T-125 (P2) : logique pure du parrainage (calcul de récompense + format des
 * codes). La résolution du parrain et la persistance sont testées via les
 * parcours d'intégration (smoke/HTTP) ; ici on fige le comportement calculable
 * sans base de données.
 */
describe("referral (T-125)", () => {
  it("génère un code de 8 caractères lisibles (sans ambiguïté)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
      // Pas de caractères ambigus 0/O/1/I.
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it("normalise un code saisi (trim + majuscules)", () => {
    expect(normalizeReferralCode("  abcd23ef ")).toBe("ABCD23EF");
    expect(normalizeReferralCode(null)).toBe("");
    expect(normalizeReferralCode(undefined)).toBe("");
    expect(normalizeReferralCode("")).toBe("");
  });

  it("calcule les récompenses parrain/filleul quand le programme est actif", () => {
    const reward = calculateReferralReward({
      enabled: true,
      referrerAmount: 10,
      refereeAmount: 5,
    });
    expect(reward).toEqual({ referrerCredit: 10, refereeCredit: 5 });
  });

  it("renvoie zéro partout quand le programme est désactivé", () => {
    const reward = calculateReferralReward({
      enabled: false,
      referrerAmount: 10,
      refereeAmount: 5,
    });
    expect(reward).toEqual({ referrerCredit: 0, refereeCredit: 0 });
  });

  it("ne produit jamais de montant négatif", () => {
    const reward = calculateReferralReward({
      enabled: true,
      // Le schéma Zod bloque ces valeurs à l'enregistrement, mais le calcul
      // reste défensif.
      referrerAmount: -100 as unknown as number,
      refereeAmount: 0,
    });
    expect(reward.referrerCredit).toBe(0);
    expect(reward.refereeCredit).toBe(0);
  });
});
