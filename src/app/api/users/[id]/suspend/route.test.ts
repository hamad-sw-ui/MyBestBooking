import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-230 (audit n°2, A10) — suspension ≠ suppression.
 *
 * Constat d'audit : `PATCH /api/users/[id]/suspend` écrivait `deletedAt`, la
 * même colonne que l'anonymisation. Un compte supprimé affichait donc
 * « Suspendu » avec un bouton « Réactiver » — et la réactivation « ressuscitait »
 * une coquille vide (`deleted-…@anonymized.local`). Le test vérifie :
 *   - suspension → `suspendedAt` posé, `deletedAt` intact (NULL) ;
 *   - sessions révoquées ;
 *   - réactivation → `suspendedAt` remis à NULL ;
 *   - compte **supprimé** → 409 (ni suspension ni réactivation) ;
 *   - non-admin → 403.
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

dbTest("T-230 — suspension et suppression sont distinctes", () => {
  let PATCH: typeof import("./route").PATCH;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;

  let adminId = "";
  let hostId = "";
  let targetId = "";
  const createdSessionIds: string[] = [];

  async function callSuspend(id: string, body: unknown) {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(`http://localhost/api/users/${id}/suspend`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return PATCH(req, { params: Promise.resolve({ id }) });
  }

  beforeAll(async () => {
    PATCH = (await import("./route")).PATCH;
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

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    hostId = host?.id ?? "";

    const [{ id }] = await db
      .insert(schema.users)
      .values({
        email: `t230-${Date.now()}@test.local`,
        passwordHash: "x",
        firstName: "Cible",
        lastName: "Suspension",
        role: "customer",
      })
      .returning({ id: schema.users.id });
    targetId = id;
  });

  afterAll(async () => {
    if (!db) return;
    const { eq, inArray } = await import("drizzle-orm");
    if (createdSessionIds.length > 0) {
      await db.delete(schema.sessions).where(inArray(schema.sessions.id, createdSessionIds));
    }
    if (targetId) await db.delete(schema.sessions).where(eq(schema.sessions.userId, targetId));
    if (targetId) await db.delete(schema.users).where(eq(schema.users.id, targetId));
  });

  it("refuse un appelant non-admin (403)", async () => {
    getCurrentUser.mockResolvedValue({ id: targetId, role: "customer", email: "x@test.local" });
    const res = await callSuspend(targetId, { suspended: true });
    expect(res.status).toBe(403);
    const [row] = await db.select().from(schema.users).where(
      (await import("drizzle-orm")).eq(schema.users.id, targetId),
    );
    expect(row.suspendedAt).toBeNull();
  });

  it("suspend : posé dans suspended_at, deleted_at reste NULL, sessions révoquées", async () => {
    const { eq } = await import("drizzle-orm");
    const [session] = await db
      .insert(schema.sessions)
      .values({
        userId: targetId,
        token: `t230-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning({ id: schema.sessions.id });
    createdSessionIds.push(session.id);

    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await callSuspend(targetId, { suspended: true, reason: "Non-respect des CGU" });
    expect(res.status).toBe(200);

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, targetId));
    expect(row.suspendedAt).not.toBeNull();
    expect(row.suspendedReason).toBe("Non-respect des CGU");
    // Régression A10 : la suspension ne doit plus se déguiser en suppression.
    expect(row.deletedAt).toBeNull();

    const remaining = await db.select().from(schema.sessions).where(eq(schema.sessions.userId, targetId));
    expect(remaining).toHaveLength(0);
  });

  it("réactive un compte simplement suspendu (suspended_at → NULL)", async () => {
    const { eq } = await import("drizzle-orm");
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await callSuspend(targetId, { suspended: false });
    expect(res.status).toBe(200);

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, targetId));
    expect(row.suspendedAt).toBeNull();
    expect(row.suspendedReason).toBeNull();
    expect(row.deletedAt).toBeNull();
  });

  it("refuse de réactiver un compte supprimé/anonymisé (409, deleted_at intact)", async () => {
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.users)
      .set({
        deletedAt: new Date(),
        email: `deleted-t230@anonymized.local`,
        firstName: "Supprimé",
        lastName: "Compte",
      })
      .where(eq(schema.users.id, targetId));

    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await callSuspend(targetId, { suspended: false });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("supprimé");

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, targetId));
    expect(row.deletedAt).not.toBeNull();
    expect(row.suspendedAt).toBeNull();
    expect(row.email).toContain("@anonymized.local");
  });

  it("refuse aussi de suspendre un compte supprimé (409)", async () => {
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await callSuspend(targetId, { suspended: true });
    expect(res.status).toBe(409);
  });

  it("404 sur identifiant inexistant", async () => {
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await callSuspend("00000000-0000-4000-8000-000000000000", { suspended: true });
    expect(res.status).toBe(404);
  });

  it("un hôte suspendu perd ses sessions actives (effet de bord conservé)", async () => {
    // `hostId` n'est connu qu'au beforeAll : le garde est donc évalué ici et
    // non à la collecte (sinon le test serait toujours ignoré).
    if (!hostId) return;
    const { eq } = await import("drizzle-orm");
    const [session] = await db
      .insert(schema.sessions)
      .values({
        userId: hostId,
        token: `t230-host-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning({ id: schema.sessions.id });
    createdSessionIds.push(session.id);

    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    expect((await callSuspend(hostId, { suspended: true })).status).toBe(200);
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.userId, hostId))).toHaveLength(0);

    // Remise en état : l'hôte seedé redevient actif.
    expect((await callSuspend(hostId, { suspended: false })).status).toBe(200);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, hostId));
    expect(row.suspendedAt).toBeNull();
  });
});
