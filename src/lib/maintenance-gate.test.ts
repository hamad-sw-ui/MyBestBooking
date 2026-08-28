import { describe, it, expect } from "vitest";
import { chooseMaintenanceGate, isMaintenanceBypassPath } from "./maintenance-gate";

/**
 * T-128 (audit n°8, P1) : la garde cliente force /maintenance uniquement
 * quand le mode est actif, pour un non-admin, hors chemins de bypass.
 */
describe("chooseMaintenanceGate (T-128)", () => {
  it("ne redirige jamais quand la maintenance est inactive", () => {
    expect(chooseMaintenanceGate(false, false, "/")).toBe(false);
    expect(chooseMaintenanceGate(false, false, "/recherche")).toBe(false);
    expect(chooseMaintenanceGate(false, true, "/dashboard")).toBe(false);
  });

  it("ne redirige jamais un admin (il doit pouvoir désactiver le mode)", () => {
    expect(chooseMaintenanceGate(true, true, "/")).toBe(false);
    expect(chooseMaintenanceGate(true, true, "/dashboard/settings")).toBe(false);
  });

  it("redirige un anonyme / non-admin sur une page normale", () => {
    expect(chooseMaintenanceGate(true, false, "/")).toBe(true);
    expect(chooseMaintenanceGate(true, false, "/recherche")).toBe(true);
    expect(chooseMaintenanceGate(true, false, "/hebergement/b-b-toscana")).toBe(true);
  });

  it("ne boucle pas sur /maintenance", () => {
    expect(chooseMaintenanceGate(true, false, "/maintenance")).toBe(false);
  });

  it("laisse passer les pages d'auth (anti-verrouillage)", () => {
    for (const p of ["/connexion", "/inscription", "/mot-de-passe-oublie", "/reinitialiser", "/verifier-email", "/activer-compte"]) {
      expect(chooseMaintenanceGate(true, false, p)).toBe(false);
    }
  });

  it("laisse passer les assets", () => {
    expect(isMaintenanceBypassPath("/_next/static/chunk.js")).toBe(true);
    expect(isMaintenanceBypassPath("/uploads/x.png")).toBe(true);
    expect(isMaintenanceBypassPath("/favicon.ico")).toBe(true);
    expect(isMaintenanceBypassPath("/robots.txt")).toBe(true);
    expect(isMaintenanceBypassPath("/sitemap.xml")).toBe(true);
  });

  it("chemin vide considéré comme bypass (sécurité)", () => {
    expect(isMaintenanceBypassPath("")).toBe(true);
    expect(chooseMaintenanceGate(true, false, "")).toBe(false);
  });
});
