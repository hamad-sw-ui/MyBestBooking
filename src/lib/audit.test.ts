import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests unitaires du module audit (T-024).
 * Le pool `@/db` est mocké pour isoler la couche métier.
 */

let inserts: unknown[] = [];
let simulateError = false;

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: async (v: unknown) => {
        if (simulateError) throw new Error("simulated DB failure");
        inserts.push(v);
      },
    }),
  },
}));

import { recordAudit, AUDIT_ACTIONS } from "./audit";

describe("audit (T-024)", () => {
  beforeEach(() => {
    inserts = [];
    simulateError = false;
  });

  it("insère une ligne complète avec tous les champs", async () => {
    await recordAudit({
      actorId: "u1",
      actorEmail: "admin@x.co",
      action: AUDIT_ACTIONS.settingUpdate,
      entityType: "setting",
      entityId: "billing",
      metadata: { taxRate: 0.2 },
    });
    expect(inserts).toHaveLength(1);
    const row = inserts[0] as Record<string, unknown>;
    expect(row.actorId).toBe("u1");
    expect(row.action).toBe("setting.update");
    expect(row.metadata).toEqual({ taxRate: 0.2 });
  });

  it("accepte actorId null (action système)", async () => {
    await recordAudit({
      actorId: null,
      action: "system.startup",
    });
    expect(inserts).toHaveLength(1);
    expect((inserts[0] as Record<string, unknown>).actorId).toBeNull();
  });

  it("nullifie les champs optionnels absents", async () => {
    await recordAudit({ actorId: "u1", action: "custom.action" });
    const row = inserts[0] as Record<string, unknown>;
    expect(row.actorEmail).toBeNull();
    expect(row.entityType).toBeNull();
    expect(row.entityId).toBeNull();
    expect(row.metadata).toBeNull();
  });

  it("best-effort : ne throw pas si la DB échoue, log stderr", async () => {
    simulateError = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAudit({ actorId: "u1", action: "x", entityType: "y", entityId: "z" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(
      "[audit] insert failed",
      expect.objectContaining({ action: "x", entity: "y:z" }),
    );
    spy.mockRestore();
  });

  it("AUDIT_ACTIONS whitelist expose les actions attendues", () => {
    expect(AUDIT_ACTIONS.settingUpdate).toBe("setting.update");
    expect(AUDIT_ACTIONS.reviewModerate).toBe("review.moderate");
    expect(AUDIT_ACTIONS.userSuspend).toBe("user.suspend");
    expect(AUDIT_ACTIONS.userReactivate).toBe("user.reactivate");
    expect(AUDIT_ACTIONS.propertyValidate).toBe("property.validate");
  });
});
