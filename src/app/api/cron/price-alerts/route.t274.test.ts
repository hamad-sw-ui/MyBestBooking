import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";

/**
 * T-274 (audit n°8, F4) — garde de défense du scan cron : un compte supprimé
 * (deletedAt posé) n'est jamais scanné, même avec alerte active + flag true
 * (état possible pour les comptes supprimés **avant** le correctif, et
 * filet contre tout futur chemin de suppression).
 *
 * Test d'intégration sur `selectActivePriceAlerts` (la requête exacte du
 * cron, factorisée pour être testable).
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

dbTest("T-274 — scan cron : les comptes supprimés sortent du périmètre", () => {
  let selectActivePriceAlerts: () => Promise<{ alert: { id: string; userId: string } }[]>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let hostId = "";
  let propId = "";
  const userIds: string[] = [];
  const alertIds: string[] = [];

  async function makeUser(input: { email: string; deleted?: boolean; flag?: boolean }): Promise<string> {
    const [u] = await db
      .insert(schema.users)
      .values({
        email: input.email,
        firstName: "Scan",
        lastName: "T274",
        role: "customer",
        language: "fr",
        priceAlertEnabled: input.flag ?? true,
        deletedAt: input.deleted ? new Date() : null,
        // Un compte supprimé porte l'adresse anonymisée (invariant T-242).
        ...(input.deleted ? { firstName: "Supprimé", lastName: "Compte" } : {}),
      })
      .returning();
    userIds.push(u.id);
    return u.id;
  }

  async function makeAlert(userId: string): Promise<string> {
    const [a] = await db
      .insert(schema.priceAlerts)
      .values({
        userId,
        propertyId: propId,
        maxPrice: "100.00",
        currency: "EUR",
        active: true,
        lastNotifiedPrice: "100.00",
      })
      .returning();
    alertIds.push(a.id);
    return a.id;
  }

  beforeAll(async () => {
    selectActivePriceAlerts = (await import("./route")).selectActivePriceAlerts;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-274 Scan Property",
        slug: generateSlug(`t274-scan-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    propId = prop.id;
  });

  afterAll(async () => {
    if (alertIds.length) await db.delete(schema.priceAlerts).where(inArray(schema.priceAlerts.id, alertIds));
    if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
  });

  it("compte supprimé : alerte active + flag true → HORS scan (la fuite de l'audit)", async () => {
    const stamp = Date.now();
    const deletedId = await makeUser({ email: `t274-scan-deleted-${stamp}@test.local`, deleted: true });
    const alertId = await makeAlert(deletedId);

    const rows = await selectActivePriceAlerts();
    const ids = rows.map((r) => r.alert.id);
    expect(ids).not.toContain(alertId);
  });

  it("compte vivant : alerte active + flag true → DANS le scan (non-régression)", async () => {
    const stamp = Date.now();
    const liveId = await makeUser({ email: `t274-scan-live-${stamp}@test.local` });
    const alertId = await makeAlert(liveId);

    const rows = await selectActivePriceAlerts();
    const ids = rows.map((r) => r.alert.id);
    expect(ids).toContain(alertId);
  });

  it("compte vivant mais flag coupé (opt-out) → HORS scan (comportement historique)", async () => {
    const stamp = Date.now();
    const optOutId = await makeUser({ email: `t274-scan-optout-${stamp}@test.local`, flag: false });
    const alertId = await makeAlert(optOutId);

    const rows = await selectActivePriceAlerts();
    const ids = rows.map((r) => r.alert.id);
    expect(ids).not.toContain(alertId);
  });
});
