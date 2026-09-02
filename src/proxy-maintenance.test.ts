import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

/**
 * T-179 — la garde « mode maintenance » vit maintenant AU PROXY.
 * Avant : redirigeur avalé dans le layout (main) (page rendue 200) +
 * racine `/` non couverte (hors groupe (main)). Ces tests verrouillent le
 * vrai 307, la whitelist, l'anti-lockout admin et le « ne jamais bloquer
 * sur erreur de sonde ».
 */

vi.mock("@/lib/maintenance", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/maintenance")>();
  return {
    ...mod,
    isMaintenanceActive: vi.fn(async () => maintenanceState.value),
  };
});

const maintenanceState = { value: false };

import { proxy } from "./proxy";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-64chars-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF";
});

async function makeSession(userId: string, role?: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const claims: Record<string, unknown> = { userId };
  if (role) claims.role = role;
  return await new SignJWT(claims).setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d").setIssuedAt().sign(secret);
}

function req(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie: `session=${cookie}` } : {},
  });
}

describe("proxy · mode maintenance (T-179)", () => {
  it("maintenance OFF : trafic inchangé (aucune régression)", async () => {
    maintenanceState.value = false;
    expect((await proxy(req("/recherche"))).status).not.toBe(307);
    expect((await proxy(req("/"))).status).not.toBe(307);
  });

  it("maintenance ON : racine et page publique → 307 /maintenance", async () => {
    maintenanceState.value = true;
    for (const path of ["/", "/recherche", "/hebergement/hotel-paris", "/aide"]) {
      const res = await proxy(req(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toMatch(/\/maintenance$/);
    }
  });

  it("maintenance ON : page protégée non-admin → /maintenance (pas /connexion)", async () => {
    maintenanceState.value = true;
    const res = await proxy(req("/mes-reservations", await makeSession("u1", "customer")));
    expect(res.headers.get("location")).toMatch(/\/maintenance$/);
  });

  it("whitelist : /connexion reste ouverte aux anonymes pendant la maintenance", async () => {
    maintenanceState.value = true;
    expect((await proxy(req("/connexion"))).status).not.toBe(307);
  });

  it("admin connecté traverse les pages pendant la maintenance", async () => {
    maintenanceState.value = true;
    const res = await proxy(req("/recherche", await makeSession("admin1", "admin")));
    expect(res.status).not.toBe(307);
  });

  it("token sans rôle (avant T-123) : traité en non-admin (prudent) pendant la maintenance", async () => {
    maintenanceState.value = true;
    const res = await proxy(req("/", await makeSession("legacy-user")));
    expect(res.headers.get("location")).toMatch(/\/maintenance$/);
  });

  it("sonde en échec → on laisse passer (ne jamais bloquer sur erreur DB)", async () => {
    maintenanceState.value = false;
    const { isMaintenanceActive } = await import("@/lib/maintenance");
    vi.mocked(isMaintenanceActive).mockRejectedValueOnce(new Error("DB down"));
    const res = await proxy(req("/recherche"));
    expect(res.status).not.toBe(307);
  });
});
