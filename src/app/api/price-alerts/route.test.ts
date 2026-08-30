import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-161 (audit n°30) — alertes prix : dates passées refusées à la création
 * (400, jamais 201) ; expiration par le cron (active=false).
 * Intégration DB réelle (skip si indisponible), auth customer mockée.
 * Ne modifie que les lignes créées puis nettoyées ici.
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("T-161 — alertes prix : dates passées et expiration", () => {
  let POST: typeof import("./route").POST;
  let expirePastStayAlerts: typeof import("../cron/price-alerts/route").expirePastStayAlerts;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let customerId = "";
  let propId = "";
  let uniqueSlug = "";
  const createdIds: string[] = [];

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const cronMod = await import("../cron/price-alerts/route");
    expirePastStayAlerts = cronMod.expirePastStayAlerts;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;
    const { eq } = await import("drizzle-orm");

    const [customer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    if (!customer) throw new Error("Seed non appliqué (customer introuvable)");
    customerId = customer.id;
    // Propriété dédiée (jamais référencée ailleurs) pour isoler le test de
    // l'upsert unique (userId, propertyId) et des données du seed.
    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    const { generateSlug } = await import("@/lib/utils");
    uniqueSlug = generateSlug(`test-t161-${Date.now()}`);
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-161 test property",
        slug: uniqueSlug,
        type: "hotel",
        description: "Dedicated integration-test property",
        status: "active",
        city: "Yaounde",
        country: "CM",
        mainImage: null,
      })
      .returning();
    propId = prop.id;
    getCurrentUser.mockResolvedValue({ ...customer, role: "customer" });
  });

  afterAll(async () => {
    const { inArray, eq } = await import("drizzle-orm");
    if (createdIds.length) {
      await db.delete(schema.priceAlerts).where(inArray(schema.priceAlerts.id, createdIds));
    }
    if (propId) {
      await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    }
  });

  async function post(body: Record<string, unknown>): Promise<Response> {
    const req = new Request("http://localhost/api/price-alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return POST(req as any);
  }

  it("dates passées → 400 (jamais 201) avec message français", async () => {
    const res = await post({
      propertyId: propId,
      maxPrice: 999,
      currency: "EUR",
      checkIn: "2020-01-10",
      checkOut: "2020-01-12",
      numAdults: 2,
      numChildren: 0,
    });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toMatch(/passé/i);
  });

  it("dates futures → 201 puis suppression (nettoyage)", async () => {
    const res = await post({
      propertyId: propId,
      maxPrice: 999,
      currency: "EUR",
      checkIn: "2099-11-10",
      checkOut: "2099-11-12",
      numAdults: 2,
      numChildren: 0,
    });
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j.alert.id).toBeTruthy();
    createdIds.push(j.alert.id);
  });

  it("cron : alerte expirée (checkOut passé) → active=false", async () => {
    // Upsert (l'alerte du test précédent peut exister pour ce couple)
    // : on force des dates expirées puis on vérifie l'expiration cron.
    const [alert] = await db
      .insert(schema.priceAlerts)
      .values({
        userId: customerId,
        propertyId: propId,
        maxPrice: "500.00",
        currency: "EUR",
        checkIn: "2020-01-01",
        checkOut: "2020-01-03",
        numAdults: 2,
        numChildren: 0,
        active: true,
      })
      .onConflictDoUpdate({
        target: [schema.priceAlerts.userId, schema.priceAlerts.propertyId],
        set: {
          maxPrice: "500.00",
          currency: "EUR",
          checkIn: "2020-01-01",
          checkOut: "2020-01-03",
          numAdults: 2,
          numChildren: 0,
          active: true,
        },
      })
      .returning();
    createdIds.push(alert.id);
    const count = await expirePastStayAlerts(new Date().toISOString().slice(0, 10));
    expect(count).toBeGreaterThanOrEqual(1);
    const [after] = await db
      .select({ active: schema.priceAlerts.active })
      .from(schema.priceAlerts)
      .where((await import("drizzle-orm")).eq(schema.priceAlerts.id, alert.id));
    expect(after?.active).toBe(false);
  });
});
