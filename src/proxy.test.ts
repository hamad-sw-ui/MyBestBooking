import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-64chars-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF";
});

async function makeSession(
  userId: string,
  role?: string,
): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const claims: Record<string, unknown> = { userId };
  if (role) claims.role = role;
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(secret);
}

function makeRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie: `session=${cookie}` } : {},
  });
}

function status(res: Response): number {
  return res.status;
}
function location(res: Response): string {
  return res.headers.get("location") ?? "";
}

describe("middleware auth (T-003, §13.5)", () => {
  it("redirige /mon-compte sans cookie vers /connexion?next=/mon-compte", async () => {
    const { proxy } = await import("./proxy");
    const res = await proxy(makeRequest("/mon-compte"));
    expect(status(res)).toBe(307);
    expect(location(res)).toMatch(/\/connexion\?next=%2Fmon-compte/);
  });

  it("redirige /dashboard sans cookie", async () => {
    const { proxy } = await import("./proxy");
    const res = await proxy(makeRequest("/dashboard"));
    expect(status(res)).toBe(307);
    expect(location(res)).toMatch(/\/connexion/);
  });

  it("redirige un cookie invalide", async () => {
    const { proxy } = await import("./proxy");
    const res = await proxy(makeRequest("/mes-reservations", "not-a-jwt"));
    expect(status(res)).toBe(307);
  });

  it("laisse passer un cookie session JWT valide", async () => {
    const { proxy } = await import("./proxy");
    const token = await makeSession("some-user-uuid");
    const res = await proxy(makeRequest("/mon-compte", token));
    // NextResponse.next() n'a pas de status 307. On vérifie qu'il n'y a
    // pas de header Location de redirect.
    expect(res.headers.get("location")).toBeNull();
  });

  it("laisse /reservation hors du matcher afin de permettre l'achat invité", async () => {
    const { config } = await import("./proxy");
    expect(config.matcher).not.toContain("/reservation/:path*");
  });
});

describe("garde de rôle dashboard (T-123 / G2)", () => {
  it("redirige un CUSTOMER hors du dashboard vers l'accueil", async () => {
    const { proxy } = await import("./proxy");
    const token = await makeSession("cust-1", "customer");
    for (const path of ["/dashboard", "/dashboard/users", "/dashboard/properties/new"]) {
      const res = await proxy(makeRequest(path, token));
      expect(status(res)).toBe(307);
      expect(location(res)).toBe("http://localhost:3000/");
    }
  });

  it("redirige un HOST hors des sections admin-only vers /dashboard", async () => {
    const { proxy } = await import("./proxy");
    const token = await makeSession("host-1", "host");
    for (const path of ["/dashboard/users", "/dashboard/settings", "/dashboard/audit", "/dashboard/promotions"]) {
      const res = await proxy(makeRequest(path, token));
      expect(status(res)).toBe(307);
      expect(location(res)).toBe("http://localhost:3000/dashboard");
    }
  });

  it("laisse un HOST accéder aux sections hôte", async () => {
    const { proxy } = await import("./proxy");
    const token = await makeSession("host-1", "host");
    for (const path of ["/dashboard", "/dashboard/properties", "/dashboard/bookings", "/dashboard/analytics", "/dashboard/billing"]) {
      const res = await proxy(makeRequest(path, token));
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("laisse un ADMIN accéder à tout le dashboard", async () => {
    const { proxy } = await import("./proxy");
    const token = await makeSession("admin-1", "admin");
    for (const path of ["/dashboard", "/dashboard/users", "/dashboard/settings", "/dashboard/promotions", "/dashboard/audit"]) {
      const res = await proxy(makeRequest(path, token));
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("ne bloque pas un token d'avant T-123 (sans claim role) sur le dashboard", async () => {
    // Rétrocompatibilité : les anciens JWT n'embarquent pas le rôle. Le proxy
    // laisse passer et les gardes RSC (base) tranchent.
    const { proxy } = await import("./proxy");
    const token = await makeSession("legacy-1"); // pas de role
    const res = await proxy(makeRequest("/dashboard", token));
    expect(res.headers.get("location")).toBeNull();
  });

  it("continue de laisser un customer sur les routes voyageur hors dashboard", async () => {
    const { proxy } = await import("./proxy");
    const token = await makeSession("cust-1", "customer");
    for (const path of ["/mon-compte", "/mes-reservations", "/mes-favoris", "/messages"]) {
      const res = await proxy(makeRequest(path, token));
      expect(res.headers.get("location")).toBeNull();
    }
  });
});

describe("garde pages d'auth pour visiteurs connectés (T-135)", () => {
  it("redirige un client connecté depuis /connexion vers l'accueil", async () => {
    const { proxy } = await import("./proxy");
    const token = await makeSession("cust-1", "customer");
    const res = await proxy(makeRequest("/connexion", token));
    expect(status(res)).toBe(307);
    expect(location(res)).toMatch(/\/$/);
  });

  it("redirige un client connecté depuis /inscription vers l'accueil", async () => {
    const { proxy } = await import("./proxy");
    const token = await makeSession("cust-1", "customer");
    const res = await proxy(makeRequest("/inscription", token));
    expect(status(res)).toBe(307);
    expect(location(res)).toMatch(/\/$/);
  });

  it("laisse un visiteur anonyme accéder à /connexion et /inscription (pas de boucle)", async () => {
    const { proxy } = await import("./proxy");
    for (const path of ["/connexion", "/inscription"]) {
      const res = await proxy(makeRequest(path));
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("ne touche pas aux pages d'auth basées sur un jeton (non matchées)", async () => {
    // /reinitialiser, /activer-compte, /mot-de-passe-oublie ne sont pas dans
    // le matcher : le proxy ne les invoque pas, donc un connecté y accède.
    // (Vérifié par l'absence de ces segments dans config.matcher.)
    const { config } = await import("./proxy");
    const matcher = JSON.stringify(config.matcher);
    expect(matcher).not.toContain("reinitialiser");
    expect(matcher).not.toContain("activer-compte");
    expect(matcher).not.toContain("mot-de-passe-oublie");
  });
});
