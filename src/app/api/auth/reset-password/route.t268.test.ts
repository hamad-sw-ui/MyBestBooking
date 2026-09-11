import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

/**
 * T-268 (audit n°7, C4) — le claim d'un profil invité prouve la maîtrise de
 * la boîte mail (le lien a été livré et suivi dedans) : le compte doit donc
 * passer `emailVerified = true` — sinon le bouton « renvoyer la
 * vérification » s'affiche juste après un claim réussi, pour un compte dont
 * la preuve vient d'être faite.
 *
 * Ce test verrouille :
 *   1. token `guest_claim` + mot de passe → 200 ET `email_verified = true` ;
 *   2. le flux historique (token `password_reset`, sans `claimGuest`) ne
 *      change pas : `email_verified` reste `false`.
 *
 * Test d'intégration : DB réelle, fixtures (2 users + 2 tokens) purgées.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const c = await pool.connect();
  await c.query("SELECT 1");
  c.release();
  await pool.end();
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const dbTest = dbAvailable ? describe : describe.skip;

// Le claim crée une session : `createSession` écrit le cookie via
// `cookies()` (next/headers), indisponible hors requête Next en vitest.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
  })),
}));

dbTest("T-268 — reset-password : claim invité → emailVerified", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let claimUserId = "";
  let resetUserId = "";

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");

    const [claimUser] = await db
      .insert(schema.users)
      .values({
        email: `t268-claim-${Date.now()}@test.local`,
        firstName: "Claim",
        lastName: "T268",
        role: "customer",
        language: "fr",
      })
      .returning();
    claimUserId = claimUser.id;
    expect(claimUser.emailVerified).toBe(false);

    const [resetUser] = await db
      .insert(schema.users)
      .values({
        email: `t268-reset-${Date.now()}@test.local`,
        firstName: "Reset",
        lastName: "T268",
        role: "customer",
        language: "fr",
      })
      .returning();
    resetUserId = resetUser.id;
  });

  afterAll(async () => {
    const ids = [claimUserId, resetUserId].filter(Boolean);
    if (ids.length) {
      await db
        .delete(schema.verificationTokens)
        .where(inArray(schema.verificationTokens.userId, ids));
      await db.delete(schema.sessions).where(inArray(schema.sessions.userId, ids));
      await db.delete(schema.users).where(inArray(schema.users.id, ids));
    }
  });

  it("claim invité (claimGuest) → mot de passe posé ET emailVerified = true", async () => {
    const { issueToken } = await import("@/lib/tokens");
    const token = await issueToken(claimUserId, "guest_claim");
    const res = await POST(
      new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.clear, password: "NouveauPass123!", claimGuest: true }),
      }) as never,
    );
    expect(res.status).toBe(200);
    const [row] = await db
      .select({ emailVerified: schema.users.emailVerified, passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.id, claimUserId));
    expect(row.emailVerified).toBe(true);
    expect(row.passwordHash).toBeTruthy();
  });

  it("flux historique (password_reset, sans claimGuest) → emailVerified inchangé (false)", async () => {
    const { issueToken } = await import("@/lib/tokens");
    const token = await issueToken(resetUserId, "password_reset");
    const res = await POST(
      new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.clear, password: "NouveauPass123!" }),
      }) as never,
    );
    expect(res.status).toBe(200);
    const [row] = await db
      .select({ emailVerified: schema.users.emailVerified, passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.id, resetUserId));
    expect(row.emailVerified).toBe(false);
    expect(row.passwordHash).toBeTruthy();
  });
});
