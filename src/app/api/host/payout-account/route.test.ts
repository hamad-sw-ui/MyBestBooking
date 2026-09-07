import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Test d'intégration — T-195 (G1/G5) : POST/GET /api/host/payout-account.
 *
 * Vérifie : création d'un compte SEPA (référence chiffrée AES-GCM, jamais en
 * clair en DB ni dans la réponse), `isDefault` sur le premier compte, audit
 * `payout.account.create`, list expurgée, re-POST idempotent (mise à jour),
 * refus du customer (403) et d'un IBAN invalide (400).
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db" });
  const c = await pool.connect();
  await c.query("SELECT 1");
  c.release();
  await pool.end();
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const dbTest = dbAvailable ? describe : describe.skip;

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

// Clé maître de TEST (64 hex = 32 octets). Ne jamais utiliser en production.
const TEST_KEY = "a".repeat(64);

dbTest("T-195 — POST/GET /api/host/payout-account (moyen de versement)", () => {
  let POST: typeof import("./route").POST;
  let GET: typeof import("./route").GET;
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let hostId = "";
  let previousKey: string | undefined;

  beforeAll(async () => {
    previousKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY;
    const route = await import("./route");
    POST = route.POST;
    GET = route.GET;
    const auth = await import("@/lib/auth");
    getCurrentUser = (auth as any).getCurrentUser;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const [host] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "host@mybestbooking.com")).limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;
  });

  afterAll(async () => {
    // nettoyage des comptes de versement et de l'audit créés par ce test
    if (hostId) {
      const accounts = await db.select({ id: schema.payoutAccounts.id }).from(schema.payoutAccounts).where(eq(schema.payoutAccounts.userId, hostId));
      if (accounts.length) {
        const { inArray } = await import("drizzle-orm");
        await db.delete(schema.payoutAccounts).where(inArray(schema.payoutAccounts.id, accounts.map((a) => a.id)));
      }
      const audit = await db.select({ id: schema.auditLog.id }).from(schema.auditLog).where(eq(schema.auditLog.entityType, "payout_account"));
      if (audit.length) {
        const { inArray } = await import("drizzle-orm");
        await db.delete(schema.auditLog).where(inArray(schema.auditLog.id, audit.map((a) => a.id)));
      }
    }
    if (previousKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = previousKey;
  });

  it("customer → 403 (accès hébergeur/admin requis)", async () => {
    getCurrentUser.mockResolvedValue({ id: "customer-id", role: "customer", currency: "EUR" });
    const { NextRequest } = await import("next/server");
    const res = await POST(new NextRequest("http://localhost/api/host/payout-account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "sepa", reference: "FR7630006000011234567890189", currency: "EUR" }),
    }));
    expect(res.status).toBe(403);
  });

  it("host → crée un compte SEPA chiffré, isDefault, journalisé, sans exposer la référence", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", currency: "EUR", email: "host@mybestbooking.com" });
    const { NextRequest } = await import("next/server");
    const iban = "FR7630006000011234567890189";
    const res = await POST(new NextRequest("http://localhost/api/host/payout-account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "sepa", reference: iban, currency: "EUR" }),
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.created).toBe(true);
    expect(body.account.provider).toBe("sepa");
    expect(body.account.isDefault).toBe(true);
    expect(body.account.currency).toBe("EUR");
    // Jamais la référence ni le secret dans la réponse.
    expect(body.account.reference).toBeUndefined();
    expect(body.account.ciphertext).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(iban);

    // Audit journalisé.
    const [a] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "payout.account.create")).limit(1);
    expect(a).toBeTruthy();
    expect(a.entityType).toBe("payout_account");

    // En DB, aucun clair.
    const [row] = await db.select().from(schema.payoutAccounts).where(eq(schema.payoutAccounts.userId, hostId)).limit(1);
    expect(row).toBeTruthy();
    expect(row.ciphertext).not.toContain(iban);
  });

  it("host → re-POST même provider = mise à jour (pas de doublon), isDefault conservé", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", currency: "EUR", email: "host@mybestbooking.com" });
    const { NextRequest } = await import("next/server");
    const res = await POST(new NextRequest("http://localhost/api/host/payout-account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "sepa", reference: "FR7630006000011234567890190", currency: "EUR" }),
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.created).toBe(false);
    expect(body.account.isDefault).toBe(true);
    const { eq: eq2, and, sql } = await import("drizzle-orm");
    const count = await db.select().from(schema.payoutAccounts).where(and(eq2(schema.payoutAccounts.userId, hostId), eq2(schema.payoutAccounts.provider, "sepa"), sql`1=1`));
    expect(count.length).toBe(1);
  });

  it("GET → liste expurgée (aucune référence/ciphertext)", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", currency: "EUR" });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.accounts)).toBe(true);
    const acct = body.accounts.find((a: any) => a.provider === "sepa");
    expect(acct).toBeTruthy();
    expect(acct.reference).toBeUndefined();
    expect(acct.ciphertext).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("FR76");
  });

  it("IBAN invalide → 400", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", currency: "EUR" });
    const { NextRequest } = await import("next/server");
    const res = await POST(new NextRequest("http://localhost/api/host/payout-account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "sepa", reference: "NOT-AN-IBAN", currency: "EUR" }),
    }));
    expect(res.status).toBe(400);
  });
});
