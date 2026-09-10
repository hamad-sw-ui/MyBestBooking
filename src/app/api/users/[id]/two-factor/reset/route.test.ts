import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-231 (audit n°2, A11) — reset support de la 2FA.
 *
 * Constat d'audit : un utilisateur ayant perdu son téléphone **et** ses codes
 * de secours n'avait aucune issue (le seul « reset » existant anonymisait le
 * compte). Le test vérifie que l'action admin :
 *   - est refusée aux non-admins (403) ;
 *   - purge secret, secret pending et codes de secours ;
 *   - révoque les sessions (un facteur potentiellement fuité ne reste pas
 *     utilisable) ;
 *   - laisse une trace d'audit `user.2fa.reset` ;
 *   - refuse un compte supprimé (409) ou sans 2FA active (400).
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

dbTest("T-231 — POST /api/users/[id]/two-factor/reset", () => {
  let POST: (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;

  let adminId = "";
  let targetId = "";
  let targetEmail = "";

  async function callReset(id: string) {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(`http://localhost/api/users/${id}/two-factor/reset`, {
      method: "POST",
    });
    return POST(req, { params: Promise.resolve({ id }) });
  }

  beforeAll(async () => {
    POST = (await import("./route")).POST as unknown as typeof POST;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const { eq } = await import("drizzle-orm");
    const [admin] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "admin@mybestbooking.com"))
      .limit(1);
    if (!admin) throw new Error("Seed non appliqué (admin introuvable)");
    adminId = admin.id;

    targetEmail = `t231-${Date.now()}@test.local`;
    const [{ id }] = await db
      .insert(schema.users)
      .values({
        email: targetEmail,
        passwordHash: "x",
        firstName: "Cible",
        lastName: "2FA",
        role: "customer",
        twoFactorEnabled: true,
        twoFactorSecret: "JBSWY3DPEHPK3PXP",
        twoFactorBackupCodes: [
          { hash: "$2a$10$abcdefghijklmnopqrstuv", usedAt: null },
          { hash: "$2a$10$zyxwvutsrqponmlkjihgfe", usedAt: null },
        ],
      })
      .returning({ id: schema.users.id });
    targetId = id;
    await db.insert(schema.sessions).values({
      userId: targetId,
      token: `t231-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  });

  afterAll(async () => {
    if (!db || !targetId) return;
    const { and, eq } = await import("drizzle-orm");
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, targetId));
    // Purge des traces d'audit créées par ce test (l'audit lui-même est
    // vérifié avant le nettoyage).
    await db
      .delete(schema.auditLog)
      .where(and(eq(schema.auditLog.entityId, targetId), eq(schema.auditLog.action, "user.2fa.reset")));
    await db.delete(schema.users).where(eq(schema.users.id, targetId));
  });

  it("refuse un non-admin (403) sans toucher au facteur", async () => {
    const { eq } = await import("drizzle-orm");
    getCurrentUser.mockResolvedValue({ id: targetId, role: "customer", email: targetEmail });
    const res = await callReset(targetId);
    expect(res.status).toBe(403);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, targetId));
    expect(row.twoFactorEnabled).toBe(true);
    expect(row.twoFactorSecret).toBe("JBSWY3DPEHPK3PXP");
  });

  it("réinitialise : secret, pending et codes de secours purgés + sessions révoquées + audit", async () => {
    const { eq, and } = await import("drizzle-orm");
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await callReset(targetId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reset: boolean; sessionsRevoked: boolean };
    expect(body.reset).toBe(true);
    expect(body.sessionsRevoked).toBe(true);

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, targetId));
    expect(row.twoFactorEnabled).toBe(false);
    expect(row.twoFactorSecret).toBeNull();
    expect(row.twoFactorPendingSecret).toBeNull();
    expect(row.twoFactorBackupCodes).toBeNull();

    const sessionsLeft = await db.select().from(schema.sessions).where(eq(schema.sessions.userId, targetId));
    expect(sessionsLeft).toHaveLength(0);

    const audits = await db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.entityId, targetId), eq(schema.auditLog.action, "user.2fa.reset")));
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[0].actorId).toBe(adminId);
  });

  it("400 si la 2FA n'est plus active (idempotence explicite)", async () => {
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await callReset(targetId);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toContain("2FA");
  });

  it("409 sur compte supprimé (anonymisé)", async () => {
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.users)
      .set({ deletedAt: new Date(), email: `deleted-t231@anonymized.local` })
      .where(eq(schema.users.id, targetId));
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await callReset(targetId);
    expect(res.status).toBe(409);
    expect((await res.json() as { error: string }).error).toContain("supprimé");
  });

  it("404 sur identifiant inexistant, 400 sur identifiant invalide", async () => {
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    expect((await callReset("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await callReset("pas-un-uuid")).status).toBe(400);
  });
});
