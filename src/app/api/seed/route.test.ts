import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Tests écrits à partir du contrat ADR-004 (double validation §13.5).
// On mocke `@/db` pour ne pas nécessiter une base réelle : le contrat de
// T-002 porte uniquement sur la garde en tête de handler.

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        limit: async () => [{ id: "existing" }], // early-exit "déjà présent"
      }),
    }),
  },
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: async (p: string) => `hashed:${p}`,
}));

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/seed", {
    method: "POST",
    headers,
  });
}

describe("POST /api/seed — garde d'accès (T-002, §13.5)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("en dev (NODE_ENV=development), aucun token requis → autorisé", async () => {
    (process.env as Record<string,string>).NODE_ENV = "development";
    delete process.env.SEED_TOKEN;
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200); // early-exit "déjà présentes" via mock
  });

  it("en prod sans SEED_TOKEN défini côté serveur → 404", async () => {
    (process.env as Record<string,string>).NODE_ENV = "production";
    delete process.env.SEED_TOKEN;
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ "x-seed-token": "anything" }));
    expect(res.status).toBe(404);
  });

  it("en prod avec SEED_TOKEN défini mais aucun header → 404", async () => {
    (process.env as Record<string,string>).NODE_ENV = "production";
    process.env.SEED_TOKEN = "correct-token-value";
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it("en prod avec mauvais token → 404", async () => {
    (process.env as Record<string,string>).NODE_ENV = "production";
    process.env.SEED_TOKEN = "correct-token-value";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ "x-seed-token": "wrong-token-value" }));
    expect(res.status).toBe(404);
  });

  it("en prod avec token de longueur différente → 404 sans crash", async () => {
    (process.env as Record<string,string>).NODE_ENV = "production";
    process.env.SEED_TOKEN = "correct-token-value";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ "x-seed-token": "short" }));
    expect(res.status).toBe(404);
  });

  it("en prod avec le bon token → autorisé (passe la garde)", async () => {
    (process.env as Record<string,string>).NODE_ENV = "production";
    process.env.SEED_TOKEN = "correct-token-value";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ "x-seed-token": "correct-token-value" }));
    // Passe la garde et tombe sur l'early-exit "déjà présentes" via mock DB
    expect(res.status).toBe(200);
  });

  it("le corps de la réponse 404 ne révèle rien de sensible", async () => {
    (process.env as Record<string,string>).NODE_ENV = "production";
    process.env.SEED_TOKEN = "correct-token-value";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ "x-seed-token": "wrong" }));
    const text = await res.text();
    expect(text).not.toMatch(/SEED_TOKEN|correct-token/i);
  });
});
