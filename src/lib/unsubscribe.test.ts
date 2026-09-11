import { describe, it, expect } from "vitest";
import {
  isUnsubscribeCategory,
  signUnsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from "./unsubscribe";

/**
 * T-239 (audit n°3, F8) — le désabonnement doit être sûr avant d'être mis
 * dans un e-mail : un jeton forgé ne doit jamais permettre de désinscrire
 * quelqu'un d'autre, ni de toucher à autre chose qu'une catégorie annoncée.
 */

const KEY = "cle-de-test-t239";

describe("T-239 — jeton de désabonnement signé", () => {
  it("accepte un jeton légitime et le refuse s'il est altéré", () => {
    const token = signUnsubscribeToken("user-1", "price_alerts", KEY);
    expect(verifyUnsubscribeToken("user-1", "price_alerts", token, KEY)).toBe(true);

    // un caractère modifié → refus
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifyUnsubscribeToken("user-1", "price_alerts", tampered, KEY)).toBe(false);
  });

  it("refuse un jeton détourné vers un autre utilisateur ou une autre clé", () => {
    const token = signUnsubscribeToken("user-1", "price_alerts", KEY);
    expect(verifyUnsubscribeToken("user-2", "price_alerts", token, KEY)).toBe(false);
    expect(verifyUnsubscribeToken("user-1", "price_alerts", token, "autre-secret")).toBe(false);
  });

  it("refuse l'absence de jeton et n'accepte qu'une catégorie connue", () => {
    expect(verifyUnsubscribeToken("user-1", "price_alerts", null, KEY)).toBe(false);
    expect(verifyUnsubscribeToken("user-1", "price_alerts", "", KEY)).toBe(false);
    expect(isUnsubscribeCategory("price_alerts")).toBe(true);
    expect(isUnsubscribeCategory("bookings")).toBe(false);
    expect(isUnsubscribeCategory(null)).toBe(false);
  });

  it("construit une URL publique complète et vérifiable", () => {
    const url = unsubscribeUrl("user-9", "price_alerts", "https://exemple.test");
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/desabonnement");
    expect(parsed.searchParams.get("u")).toBe("user-9");
    expect(parsed.searchParams.get("c")).toBe("price_alerts");
    expect(
      verifyUnsubscribeToken("user-9", "price_alerts", parsed.searchParams.get("s"), KEY),
    ).toBe(false); // signé avec le secret réel, pas la clé de test
  });
});
