import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests unitaires du module maintenance (T-022).
 * On mocke `./settings.getSetting` pour piloter précisément
 * l'état du booléen sans base de données.
 */

const mockSettings = {
  security: {
    minPasswordLength: 8,
    sessionDays: 30,
    twoFactorRequiredHosts: false,
    maintenanceMode: false,
  },
};

vi.mock("./settings", () => ({
  getSetting: async (key: string) => {
    if (key === "security") return mockSettings.security;
    throw new Error(`unmocked key ${key}`);
  },
}));

import {
  isMaintenanceActive,
  assertNotMaintenance,
  shouldBypassMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "./maintenance";

describe("maintenance.shouldBypassMaintenance (T-022)", () => {
  it("laisse passer les routes auth", () => {
    expect(shouldBypassMaintenance("/api/auth/login")).toBe(true);
    expect(shouldBypassMaintenance("/api/auth/logout")).toBe(true);
    expect(shouldBypassMaintenance("/api/auth/me")).toBe(true);
  });

  it("laisse passer les routes admin (anti-lockout)", () => {
    expect(shouldBypassMaintenance("/api/admin/settings")).toBe(true);
    expect(shouldBypassMaintenance("/api/admin/settings/security")).toBe(true);
  });

  it("laisse passer les pages hors maintenance", () => {
    expect(shouldBypassMaintenance("/maintenance")).toBe(true);
    expect(shouldBypassMaintenance("/connexion")).toBe(true);
  });

  it("laisse passer les assets", () => {
    expect(shouldBypassMaintenance("/_next/static/x.js")).toBe(true);
    expect(shouldBypassMaintenance("/favicon.ico")).toBe(true);
    expect(shouldBypassMaintenance("/robots.txt")).toBe(true);
    expect(shouldBypassMaintenance("/sitemap.xml")).toBe(true);
    expect(shouldBypassMaintenance("/uploads/x.png")).toBe(true);
  });

  it("bloque les routes métier", () => {
    expect(shouldBypassMaintenance("/")).toBe(false);
    expect(shouldBypassMaintenance("/recherche")).toBe(false);
    expect(shouldBypassMaintenance("/api/bookings")).toBe(false);
    expect(shouldBypassMaintenance("/dashboard/bookings")).toBe(false);
    expect(shouldBypassMaintenance("/mon-compte")).toBe(false);
  });
});

describe("maintenance.assertNotMaintenance (T-022)", () => {
  beforeEach(() => {
    mockSettings.security.maintenanceMode = false;
  });

  it("ne throw pas si maintenance inactive (peu importe le rôle)", async () => {
    mockSettings.security.maintenanceMode = false;
    await expect(assertNotMaintenance(null)).resolves.toBeUndefined();
    await expect(assertNotMaintenance({ role: "customer" })).resolves.toBeUndefined();
    await expect(assertNotMaintenance({ role: "admin" })).resolves.toBeUndefined();
  });

  it("throw MaintenanceError si maintenance active et user non admin", async () => {
    mockSettings.security.maintenanceMode = true;
    await expect(assertNotMaintenance(null)).rejects.toThrow(MaintenanceError);
    await expect(assertNotMaintenance({ role: "customer" })).rejects.toThrow(
      MaintenanceError,
    );
    await expect(assertNotMaintenance({ role: "host" })).rejects.toThrow(
      MaintenanceError,
    );
  });

  it("ne throw pas si admin même en maintenance", async () => {
    mockSettings.security.maintenanceMode = true;
    await expect(assertNotMaintenance({ role: "admin" })).resolves.toBeUndefined();
  });

  it("MaintenanceError porte code et retryAfter", async () => {
    mockSettings.security.maintenanceMode = true;
    try {
      await assertNotMaintenance(null);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MaintenanceError);
      expect((e as MaintenanceError).code).toBe("MAINTENANCE_MODE");
      expect((e as MaintenanceError).retryAfterSeconds).toBe(60);
    }
  });
});

describe("maintenance.isMaintenanceActive (T-022)", () => {
  it("reflète le settings", async () => {
    mockSettings.security.maintenanceMode = false;
    expect(await isMaintenanceActive()).toBe(false);
    mockSettings.security.maintenanceMode = true;
    expect(await isMaintenanceActive()).toBe(true);
  });
});

describe("maintenance.maintenanceResponse (T-022)", () => {
  it("retourne 503 + Retry-After", async () => {
    const r = await maintenanceResponse(45);
    expect(r.status).toBe(503);
    expect(r.headers.get("Retry-After")).toBe("45");
    const body = await r.json();
    expect(body.code).toBe("MAINTENANCE_MODE");
  });
});
