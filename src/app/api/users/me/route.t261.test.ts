import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";

/**
 * T-261 (audit n°6, B9) — préférences de notification par utilisateur.
 *
 * Vérifié ici (contrats d'API) :
 *  - `PATCH /api/users/me` accepte et persiste les trois catégories ;
 *  - une clé inconnue est refusée en 400 (schéma strict) ;
 *  - `null` remet la colonne à NULL → héritage du réglage global ;
 *  - `GET /api/auth/me` renvoie les préférences normalisées, seul moyen pour
 *    l'écran de `/mon-compte` de les afficher ;
 *  - un PATCH sans `notificationPrefs` ne touche pas au réglage existant.
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ delete: vi.fn(), get: vi.fn(), set: vi.fn() })),
}));

function patchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/users/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

dbTest("T-261 — préférences de notification par utilisateur", () => {
  let PATCH: typeof import("./route").PATCH;
  let GET_ME: typeof import("../../auth/me/route").GET;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let userId = "";
  let userEmail = "";

  beforeAll(async () => {
    PATCH = (await import("./route")).PATCH;
    GET_ME = (await import("../../auth/me/route")).GET;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    getCurrentUser = (await import("@/lib/auth")).getCurrentUser as unknown as ReturnType<
      typeof vi.fn
    >;

    userEmail = `t261-notif-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@test.local`;
    const [user] = await db
      .insert(schema.users)
      .values({ email: userEmail, firstName: "Notif", lastName: "Prefs", role: "customer" })
      .returning();
    userId = user.id;
    // Comme le vrai `getCurrentUser`, le mock relit la ligne : c'est la seule
    // façon de prouver que `GET /api/auth/me` expose bien ce que PATCH a écrit.
    getCurrentUser.mockImplementation(async () => {
      const [row] = await db.select().from(schema.users).where(inArray(schema.users.id, [userId]));
      return row ?? null;
    });
  });

  afterAll(async () => {
    if (userId) await db.delete(schema.users).where(inArray(schema.users.id, [userId]));
  });

  it("persiste les trois catégories et les renvoie normalisées", async () => {
    const res = await PATCH(patchRequest({
      notificationPrefs: { stayReminders: false, reviewRequests: true, moderationDecisions: false },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.notificationPrefs).toEqual({
      stayReminders: false,
      reviewRequests: true,
      moderationDecisions: false,
    });

    const [row] = await db.select().from(schema.users).where(inArray(schema.users.id, [userId]));
    expect(row.notificationPrefs).toEqual({
      stayReminders: false,
      reviewRequests: true,
      moderationDecisions: false,
    });
  });

  it("expose les préférences à l'écran via GET /api/auth/me", async () => {
    const res = await GET_ME();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.notificationPrefs).toEqual({
      stayReminders: false,
      reviewRequests: true,
      moderationDecisions: false,
    });
  });

  it("refuse une clé inconnue (400, schéma strict) sans rien écrire", async () => {
    const res = await PATCH(patchRequest({ notificationPrefs: { stayReminders: false, bonus: true } }));
    expect(res.status).toBe(400);
    const [row] = await db.select().from(schema.users).where(inArray(schema.users.id, [userId]));
    expect(row.notificationPrefs).toEqual({
      stayReminders: false,
      reviewRequests: true,
      moderationDecisions: false,
    });
  });

  it("un PATCH sans préférences ne touche pas au réglage existant", async () => {
    const res = await PATCH(patchRequest({ firstName: "Notif2" }));
    expect(res.status).toBe(200);
    const [row] = await db.select().from(schema.users).where(inArray(schema.users.id, [userId]));
    expect(row.notificationPrefs).toEqual({
      stayReminders: false,
      reviewRequests: true,
      moderationDecisions: false,
    });
  });

  it("`null` remet la colonne à NULL → héritage du réglage global", async () => {
    const res = await PATCH(patchRequest({ notificationPrefs: null }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.notificationPrefs).toBeNull();
    const [row] = await db.select().from(schema.users).where(inArray(schema.users.id, [userId]));
    expect(row.notificationPrefs).toBeNull();
  });
});
