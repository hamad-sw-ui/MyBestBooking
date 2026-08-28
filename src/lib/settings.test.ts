import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests unitaires du module settings (T-021, ADR-007).
 * Le pool `@/db` est mocké pour ne pas nécessiter une base réelle : le
 * contrat testé ici porte sur le typage/validation, le fallback DEFAULTS,
 * le cache et le deep-merge.
 */

type Row = { key: string; value: unknown };
const store = new Map<string, Row>();

vi.mock("@/db", () => {
  return {
    db: {
      select: () => ({
        from: () => {
          const rows = Array.from(store.values());
          const chain = {
            where: (_pred: unknown) => ({
              limit: async (_n: number) => rows,
            }),
          };
          // permet aussi le pattern `.from(t)` (sans .where) utilisé par
          // getAllSettings — on rend l'objet awaitable.
          return Object.assign(Promise.resolve(rows), chain);
        },
      }),
      insert: () => ({
        values: (v: Row) => ({
          onConflictDoUpdate: async ({ set }: { set: Partial<Row> }) => {
            const merged: Row = { ...v, ...set };
            store.set(v.key, { key: v.key, value: merged.value });
          },
        }),
      }),
    },
  };
});

// Import après le mock.
import {
  getSetting,
  setSetting,
  getAllSettings,
  clearSettingsCache,
  DEFAULTS,
  getProviderStatus,
} from "./settings";

describe("settings (T-021)", () => {
  beforeEach(() => {
    store.clear();
    clearSettingsCache();
  });

  it("getSetting renvoie DEFAULTS quand la clé n'existe pas", async () => {
    const billing = await getSetting("billing");
    expect(billing.taxRate).toBe(0.1);
    expect(billing.defaultCommissionRate).toBe(15);
  });

  it("setSetting puis getSetting → nouvelle valeur", async () => {
    await setSetting(
      "billing",
      { taxRate: 0.2, defaultCommissionRate: 18 },
      "00000000-0000-0000-0000-000000000000",
    );
    const billing = await getSetting("billing");
    expect(billing.taxRate).toBe(0.2);
    expect(billing.defaultCommissionRate).toBe(18);
  });

  it("Zod refuse une TVA négative", async () => {
    await expect(
      setSetting("billing", { taxRate: -0.1, defaultCommissionRate: 15 }, null),
    ).rejects.toThrow();
  });

  it("Zod refuse une TVA > 1", async () => {
    await expect(
      setSetting("billing", { taxRate: 1.5, defaultCommissionRate: 15 }, null),
    ).rejects.toThrow();
  });

  it("Zod refuse des seuils bestrewards non croissants", async () => {
    await expect(
      setSetting(
        "bestrewards",
        { thresholds: [10, 5], discounts: [10, 15, 20], referral: { enabled: true, referrerAmount: 10, refereeAmount: 5 } },
        null,
      ),
    ).rejects.toThrow();
  });

  it("getSetting utilise le cache jusqu'à invalidation", async () => {
    await setSetting(
      "billing",
      { taxRate: 0.25, defaultCommissionRate: 12 },
      null,
    );
    const first = await getSetting("billing");
    // Modifie le store sous les pieds du module → sans cache on lirait
    // la nouvelle valeur, avec cache on lit encore l'ancienne.
    store.set("billing", {
      key: "billing",
      value: { taxRate: 0.99, defaultCommissionRate: 99 },
    });
    const second = await getSetting("billing");
    expect(second).toEqual(first);
    clearSettingsCache();
    const third = await getSetting("billing");
    expect(third.taxRate).toBe(0.99);
  });

  it("mergeDefaults comble un payload partiel avec les DEFAULTS", async () => {
    // On insère volontairement un objet incomplet (legacy).
    store.set("general", {
      key: "general",
      value: { siteName: "Custom Name" },
    });
    const general = await getSetting("general");
    expect(general.siteName).toBe("Custom Name");
    expect(general.supportEmail).toBe(DEFAULTS.general.supportEmail);
    expect(general.defaultCurrency).toBe("EUR");
  });

  it("getAllSettings renvoie toutes les sections avec fallback", async () => {
    const all = await getAllSettings();
    expect(Object.keys(all).sort()).toEqual([
      "bestrewards",
      "billing",
      "cancellation",
      "emailTemplates",
      "general",
      "notifications",
      "reviews",
      "security",
    ]);
    expect(all.billing.taxRate).toBe(0.1);
    // T-125 (P1) : la modération des avis est désactivée par défaut
    // (préserve le comportement historique de publication immédiate).
    expect(all.reviews.requireModeration).toBe(false);
    // T-025 : emailTemplates est bien exposé
    expect(all.emailTemplates.emailVerification.subject).toContain("Vérifiez");
  });

  it("getProviderStatus lit uniquement les env vars, jamais leurs valeurs", () => {
    const before = { ...process.env };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.RESEND_API_KEY;
    let s = getProviderStatus();
    expect(s).toEqual({ stripe: false, resend: false, s3: false });
    process.env.RESEND_API_KEY = "re_xxx";
    s = getProviderStatus();
    expect(s.resend).toBe(true);
    process.env = before;
  });
});
