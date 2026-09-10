import { describe, it, expect } from "vitest";
import {
  EMPTY_THREAD_VISIBLE_DAYS,
  EMPTY_THREAD_VISIBLE_MS,
  isConversationVisible,
} from "./conversation-visibility";

/**
 * T-217/P7 — visibilité des fils dans la boîte de réception.
 *
 * Règle : un fil avec message est toujours visible ; un fil vide n'est visible
 * que dans sa fenêtre de rattrapage (T-206/F9 reste la règle au-delà).
 */
describe("isConversationVisible (T-217/P7)", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");

  it("affiche toujours un fil qui contient au moins un message", () => {
    expect(
      isConversationVisible({ hasMessage: true, createdAt: new Date("2020-01-01") }, now),
    ).toBe(true);
  });

  it("affiche un fil vide créé à l'instant (cas « Contacter l'hôte »)", () => {
    expect(isConversationVisible({ hasMessage: false, createdAt: now }, now)).toBe(true);
  });

  it("affiche un fil vide encore dans la fenêtre de rattrapage", () => {
    const createdAt = new Date(now.getTime() - EMPTY_THREAD_VISIBLE_MS + 60_000);
    expect(isConversationVisible({ hasMessage: false, createdAt }, now)).toBe(true);
  });

  it("masque un fil vide au-delà de la fenêtre (règle T-206/F9 conservée)", () => {
    const createdAt = new Date(now.getTime() - EMPTY_THREAD_VISIBLE_MS - 60_000);
    expect(isConversationVisible({ hasMessage: false, createdAt }, now)).toBe(false);
  });

  it("accepte une date sérialisée en ISO (réponse API)", () => {
    const createdAt = new Date(now.getTime() - 3_600_000).toISOString();
    expect(isConversationVisible({ hasMessage: false, createdAt }, now)).toBe(true);
  });

  it("reste fail-open sur une date invalide (un fil récent ne doit jamais disparaître)", () => {
    expect(isConversationVisible({ hasMessage: false, createdAt: "pas-une-date" }, now)).toBe(true);
  });

  it("expose la fenêtre en jours (7 jours par défaut, documenté)", () => {
    expect(EMPTY_THREAD_VISIBLE_DAYS).toBe(7);
    expect(EMPTY_THREAD_VISIBLE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
