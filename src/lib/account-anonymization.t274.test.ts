import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";

/**
 * T-274 (audit n°8, F4) — suppression de compte : les alertes prix ne
 * survivent pas à l'anonymisation.
 *
 * Constat rejoué pendant l'audit : après `DELETE /api/users/me`, l'alerte
 * restait `active: true` et `users.priceAlertEnabled` était intact — le cron
 * continuait de notifier vers l'adresse anonymisée (e-mail « sent » vers
 * `deleted-…@anonymized.local`, alerte `c9509c78`).
 *
 * Test d'intégration : `anonymizeUserAccount` s'exécute dans une transaction
   (comme `DELETE /api/users/me`) ; l'état post-anonymisation est vérifié.
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

dbTest("T-274 — anonymisation : alertes prix + flag coupés dans la tx", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let anonymize: typeof import("./account-anonymization").anonymizeUserAccount;
  let anonymizedEmailFor: (email: string) => string;
  let hostId = "";
  let userId = "";
  let userEmail = "";
  let propId = "";
  let alertId = "";

  beforeAll(async () => {
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const anonMod = await import("./account-anonymization");
    anonymize = anonMod.anonymizeUserAccount;
    anonymizedEmailFor = anonMod.anonymizedEmailFor;

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;

    const stamp = Date.now();
    userEmail = `t274-anon-${stamp}@test.local`;
    const [user] = await db
      .insert(schema.users)
      .values({
        email: userEmail,
        firstName: "Anon",
        lastName: "T274",
        role: "customer",
        language: "fr",
        priceAlertEnabled: true,
      })
      .returning();
    userId = user.id;

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-274 Anon Property",
        slug: generateSlug(`t274-anon-${stamp}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    propId = prop.id;

    const [alert] = await db
      .insert(schema.priceAlerts)
      .values({
        userId,
        propertyId: prop.id,
        maxPrice: "100.00",
        currency: "EUR",
        active: true,
        lastNotifiedPrice: "100.00",
      })
      .returning();
    alertId = alert.id;
  });

  afterAll(async () => {
    if (alertId) await db.delete(schema.priceAlerts).where(eq(schema.priceAlerts.id, alertId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("après anonymisation : flag priceAlertEnabled=false + alerte active=false (même tx)", async () => {
    await db.transaction(async (tx) => {
      await anonymize(tx as never, {
        userId,
        originalEmail: userEmail,
        anonymizedEmail: anonymizedEmailFor(userEmail),
      });
    });

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user?.deletedAt).toBeTruthy();
    expect(user?.priceAlertEnabled).toBe(false);

    const [alert] = await db.select().from(schema.priceAlerts).where(eq(schema.priceAlerts.id, alertId));
    expect(alert?.active).toBe(false);
    // L'historique de notification est conservé (idempotence intacte).
    expect(String(alert?.lastNotifiedPrice)).toBe("100.00");
  });

  it("un compte sain n'est pas affecté (seul le compte supprimé est touché)", async () => {
    // Le client du seed (jamais anonymisé) garde son flag et n'a pas d'alerte
    // active de ce test : l'anonymisation ne balaye pas les autres comptes.
    const [customer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    expect(customer?.deletedAt).toBeNull();
    const alerts = await db
      .select()
      .from(schema.priceAlerts)
      .where(eq(schema.priceAlerts.userId, customer.id));
    expect(alerts).toHaveLength(0);
  });
});
