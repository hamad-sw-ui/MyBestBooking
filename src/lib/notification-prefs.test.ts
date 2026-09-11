import { describe, it, expect } from "vitest";
import {
  USER_NOTIFICATION_CATEGORIES,
  categoryForNotificationKey,
  enabledFor,
  isCategoryDisabled,
  parseUserNotificationPrefs,
} from "./notification-prefs";

/**
 * T-261 (audit n°6, B9) — préférences de notification par utilisateur.
 *
 * L'écran de `/mon-compte` n'exposait que les alertes prix : les onze autres
 * interrupteurs étaient des réglages globaux d'administration. Le contrat de
 * cette brique est **non régressif** : tant qu'un compte n'a rien réglé
 * (`notification_prefs` NULL), chaque envoi se comporte exactement comme avant ;
 * un utilisateur ne peut que couper une catégorie, jamais réactiver ce que
 * l'équipe a désactivé.
 */

describe("catégories et clés de réglage (T-261)", () => {
  it("rattache chaque clé réglable à une seule catégorie", () => {
    const keys = [
      "bookingReminderJ3",
      "bookingReminderJ1",
      "reviewRequest",
      "reviewModerated",
      "propertyApproved",
      "propertyRejected",
    ];
    for (const key of keys) {
      expect(categoryForNotificationKey(key)).not.toBeNull();
    }
    // Aucune collision : chaque clé mène à une catégorie unique.
    expect(new Set(keys.map(categoryForNotificationKey)).size).toBe(
      USER_NOTIFICATION_CATEGORIES.length,
    );
  });

  it("laisse hors périmètre les envois transactionnels", () => {
    for (const key of [
      "welcomeEmail",
      "bookingConfirmation",
      "bookingPaymentReminder",
      "bookingRequestExpired",
      "reviewPublished",
      "priceAlerts",
      "newsletter",
    ]) {
      expect(categoryForNotificationKey(key)).toBeNull();
    }
  });
});

describe("lecture défensive de la colonne jsonb (T-261)", () => {
  it("traite l'absence de réglage comme un héritage", () => {
    for (const raw of [null, undefined, {}, [], "", "pas du json", "{", 42, true]) {
      expect(parseUserNotificationPrefs(raw)).toBeNull();
    }
  });

  it("ne retient que les clés booléennes connues", () => {
    expect(
      parseUserNotificationPrefs({
        stayReminders: false,
        reviewRequests: true,
        moderationDecisions: "oui",
        inventee: false,
      }),
    ).toEqual({ stayReminders: false, reviewRequests: true });
  });

  it("accepte la forme chaîne (jsonb relu par certains drivers)", () => {
    expect(parseUserNotificationPrefs('{"reviewRequests":false}')).toEqual({
      reviewRequests: false,
    });
  });
});

describe("enabledFor — l'admin reste maître, l'utilisateur ne peut que restreindre (T-261)", () => {
  it("un global coupé n'est jamais réactivé par une préférence", () => {
    expect(enabledFor({ stayReminders: true }, "bookingReminderJ3", false)).toBe(false);
    expect(enabledFor(null, "reviewRequest", false)).toBe(false);
  });

  it("sans réglage utilisateur, l'envoi suit exactement le global", () => {
    for (const key of [
      "bookingReminderJ3",
      "bookingReminderJ1",
      "reviewRequest",
      "reviewModerated",
      "propertyApproved",
      "propertyRejected",
    ]) {
      expect(enabledFor(null, key, true)).toBe(true);
      expect(enabledFor({}, key, true)).toBe(true);
    }
  });

  it("une catégorie coupée arrête tous ses envois, sans toucher aux autres", () => {
    const prefs = { stayReminders: false };
    expect(enabledFor(prefs, "bookingReminderJ3", true)).toBe(false);
    expect(enabledFor(prefs, "bookingReminderJ1", true)).toBe(false);
    expect(enabledFor(prefs, "reviewRequest", true)).toBe(true);
    expect(enabledFor(prefs, "reviewModerated", true)).toBe(true);
    expect(isCategoryDisabled(prefs, "stayReminders")).toBe(true);
    expect(isCategoryDisabled(prefs, "reviewRequests")).toBe(false);
  });

  it("les envois transactionnels restent régis par le seul global", () => {
    const prefs = {
      stayReminders: false,
      reviewRequests: false,
      moderationDecisions: false,
    };
    expect(enabledFor(prefs, "bookingConfirmation", true)).toBe(true);
    expect(enabledFor(prefs, "welcomeEmail", true)).toBe(true);
    expect(enabledFor(prefs, "bookingConfirmation", false)).toBe(false);
  });

  it("une valeur illisible retombe sur l'héritage (jamais d'exception)", () => {
    expect(enabledFor("n'importe quoi", "reviewRequest", true)).toBe(true);
    expect(enabledFor({ moderationDecisions: "non" }, "propertyApproved", true)).toBe(true);
  });
});
