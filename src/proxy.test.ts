import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-64chars-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF";
});

async function makeSession(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return await new SignJWT({ userId })
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

describe("middleware auth (T-003, §13.5)", () => {
  it("redirige /mon-compte sans cookie vers /connexion?next=/mon-compte", async () => {
    const { proxy } = await import("./proxy");
    const res = await proxy(makeRequest("/mon-compte"));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toMatch(/\/connexion\?next=%2Fmon-compte/);
  });

  it("redirige /dashboard sans cookie", async () => {
    const { proxy } = await import("./proxy");
    const res = await proxy(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/connexion/);
  });

  it("redirige un cookie invalide", async () => {
    const { proxy } = await import("./proxy");
    const res = await proxy(makeRequest("/mes-reservations", "not-a-jwt"));
    expect(res.status).toBe(307);
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
