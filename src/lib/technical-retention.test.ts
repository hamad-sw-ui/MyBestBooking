import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";

/**
 * T-243 (audit n°4, constat N2) — rétention des données techniques.
 *
 * Vérifie la politique exacte :
 *   - sessions expirées depuis plus de 7 jours → supprimées ;
 *   - session expirée récemment ou encore valide → conservée ;
 *   - e-mails `sent`/`failed` de plus de 90 jours → supprimés ;
 *   - e-mail récent → conservé ;
 *   - e-mail `pending` ancien → **jamais** supprimé (livraison encore due) ;
 *   - la mesure d'audit est renvoyée sans purge.
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

dbTest("T-243 — purgeTechnicalData (sessions expirées, e-mails terminaux)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let purgeTechnicalData: typeof import("@/lib/technical-retention").purgeTechnicalData;

  let userId = "";
  const day = 86_400_000;
  const stamp = Date.now();
  const keys = {
    sentOld: `t243-sent-old-${stamp}`,
    failedOld: `t243-failed-old-${stamp}`,
    sentRecent: `t243-sent-recent-${stamp}`,
    pendingOld: `t243-pending-old-${stamp}`,
  };
  const tokens = {
    expired: `t243-expired-${stamp}`,
    recent: `t243-recent-${stamp}`,
    valid: `t243-valid-${stamp}`,
  };

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const mod = await import("@/lib/technical-retention");
    purgeTechnicalData = mod.purgeTechnicalData;

    const [user] = await db
      .insert(schema.users)
      .values({
        email: `t243-retention-${stamp}@test.local`,
        firstName: "Retention",
        lastName: "Test",
        role: "customer",
      })
      .returning();
    userId = user.id;

    await db.insert(schema.sessions).values([
      // expirée depuis 30 jours → doit partir
      { userId, token: tokens.expired, expiresAt: new Date(Date.now() - 30 * day) },
      // expirée depuis 2 jours (< 7 j) → conservée
      { userId, token: tokens.recent, expiresAt: new Date(Date.now() - 2 * day) },
      // encore valide → conservée
      { userId, token: tokens.valid, expiresAt: new Date(Date.now() + 5 * day) },
    ]);

    await db.insert(schema.emailOutbox).values([
      {
        eventKey: keys.sentOld,
        to: "retention@test.local",
        subject: "vieux sent",
        html: "<p>vieux</p>",
        text: "vieux",
        status: "sent",
        sentAt: new Date(Date.now() - 120 * day),
        createdAt: new Date(Date.now() - 120 * day),
      },
      {
        eventKey: keys.failedOld,
        to: "retention@test.local",
        subject: "vieux failed",
        html: "<p>echec</p>",
        text: "echec",
        status: "failed",
        failedAt: new Date(Date.now() - 100 * day),
        createdAt: new Date(Date.now() - 100 * day),
      },
      {
        eventKey: keys.sentRecent,
        to: "retention@test.local",
        subject: "recent sent",
        html: "<p>recent</p>",
        text: "recent",
        status: "sent",
        sentAt: new Date(),
      },
      {
        // `createdAt` forcé dans le passé : la ligne est ancienne mais son
        // envoi est encore dû → elle ne doit jamais être purgée.
        eventKey: keys.pendingOld,
        to: "retention@test.local",
        subject: "vieux pending",
        html: "<p>pending</p>",
        text: "pending",
        status: "pending",
        createdAt: new Date(Date.now() - 200 * day),
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(schema.emailOutbox).where(inArray(schema.emailOutbox.eventKey, Object.values(keys)));
    await db.delete(schema.sessions).where(inArray(schema.sessions.token, Object.values(tokens)));
    if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("supprime les sessions expirées > 7 j et les e-mails terminaux > 90 j, conserve le reste", async () => {
    const result = await purgeTechnicalData();

    expect(result.sessionsPurged).toBeGreaterThanOrEqual(1);
    expect(result.emailsPurged).toBeGreaterThanOrEqual(2);
    expect(typeof result.auditRows).toBe("number");

    const remainingTokens = (
      await db
        .select({ token: schema.sessions.token })
        .from(schema.sessions)
        .where(inArray(schema.sessions.token, Object.values(tokens)))
    ).map((r) => r.token);
    expect(remainingTokens).not.toContain(tokens.expired);
    expect(remainingTokens).toContain(tokens.recent);
    expect(remainingTokens).toContain(tokens.valid);

    const remainingKeys = (
      await db
        .select({ eventKey: schema.emailOutbox.eventKey })
        .from(schema.emailOutbox)
        .where(inArray(schema.emailOutbox.eventKey, Object.values(keys)))
    ).map((r) => r.eventKey);
    expect(remainingKeys).not.toContain(keys.sentOld);
    expect(remainingKeys).not.toContain(keys.failedOld);
    expect(remainingKeys).toContain(keys.sentRecent);
    expect(remainingKeys).toContain(keys.pendingOld);
  });

  it("est idempotente : une seconde passe ne supprime plus rien de ces lignes", async () => {
    const before = await db
      .select({ token: schema.sessions.token })
      .from(schema.sessions)
      .where(inArray(schema.sessions.token, Object.values(tokens)));
    const result = await purgeTechnicalData();
    expect(result.sessionsPurged).toBe(0);
    const after = await db
      .select({ token: schema.sessions.token })
      .from(schema.sessions)
      .where(inArray(schema.sessions.token, Object.values(tokens)));
    expect(after.length).toBe(before.length);
  });
});
