import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";

/**
 * T-154c (audit n°26, P2-7) — une alerte prix ne doit plus être
 * silencieusement morte quand aucune chambre active n'existe dans sa devise :
 * `quotePriceAlert` retente sans filtre devise et convertit le meilleur prix
 * vers la devise de l'alerte (taux figés RATES_FROM_EUR). Cas existants
 * inchangés (devise présente → min brut en devise unique).
 *
 * Skip automatique si la DB de test n'est pas accessible. Property/rooms
 * créées puis supprimées.
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

dbTest("quotePriceAlert — repli devise (T-154c / audit n°26, P2-7)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let quotePriceAlert: typeof import("./price-alert-quote").quotePriceAlert;
  let usdOnlyPropId = "";
  let eurPropId = "";
  const roomIds: string[] = [];
  let hostId = "";

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const quoteMod = await import("./price-alert-quote");
    quotePriceAlert = quoteMod.quotePriceAlert;
    const { eq } = await import("drizzle-orm");
    const { generateSlug } = await import("@/lib/utils");

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;

    const [usdProp] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-154c USD Only",
        slug: generateSlug(`t154c-usd-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    usdOnlyPropId = usdProp.id;
    const [usdRoom] = await db
      .insert(schema.rooms)
      .values({
        propertyId: usdProp.id,
        name: "T-154c USD Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        quantity: 1,
        isActive: true,
        currency: "USD",
      })
      .returning();
    roomIds.push(usdRoom.id);

    const [eurProp] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-154c EUR Only",
        slug: generateSlug(`t154c-eur-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    eurPropId = eurProp.id;
    const [eurRoom] = await db
      .insert(schema.rooms)
      .values({
        propertyId: eurProp.id,
        name: "T-154c EUR Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "118.67",
        quantity: 1,
        isActive: true,
        currency: "EUR",
      })
      .returning();
    roomIds.push(eurRoom.id);
  });

  afterAll(async () => {
    const { eq } = await import("drizzle-orm");
    for (const id of roomIds) await db.delete(schema.rooms).where(eq(schema.rooms.id, id));
    if (usdOnlyPropId) await db.delete(schema.properties).where(eq(schema.properties.id, usdOnlyPropId));
    if (eurPropId) await db.delete(schema.properties).where(eq(schema.properties.id, eurPropId));
  });

  it("alerte EUR sur propriété USD only → quote converti 92,59 EUR (plus de null)", async () => {
    const quote = await quotePriceAlert({
      propertyId: usdOnlyPropId,
      currency: "EUR",
      context: {},
    });
    expect(quote).not.toBeNull();
    expect(quote).toEqual({ price: 92.59, currency: "EUR", mode: "base" });
  });

  it("alerte XAF sur propriété USD only → 60 736,76 XAF converti", async () => {
    const quote = await quotePriceAlert({
      propertyId: usdOnlyPropId,
      currency: "XAF",
      context: {},
    });
    expect(quote).not.toBeNull();
    expect(quote!.currency).toBe("XAF");
    expect(quote!.price).toBe(60736.76);
  });

  it("alerte USD sur propriété USD only → 100,00 USD (comportement historique)", async () => {
    const quote = await quotePriceAlert({
      propertyId: usdOnlyPropId,
      currency: "USD",
      context: {},
    });
    expect(quote).toEqual({ price: 100, currency: "USD", mode: "base" });
  });

  it("alerte EUR sur propriété EUR → 118,67 € (non-régression)", async () => {
    const quote = await quotePriceAlert({
      propertyId: eurPropId,
      currency: "EUR",
      context: {},
    });
    expect(quote).toEqual({ price: 118.67, currency: "EUR", mode: "base" });
  });

  it("aucune chambre active → null (inchangé)", async () => {
    const quote = await quotePriceAlert({
      propertyId: usdOnlyPropId,
      currency: "XAF",
      context: {},
    });
    expect(quote).not.toBeNull();
    await db
      .update(schema.rooms)
      .set({ isActive: false })
      .where(eq(schema.rooms.propertyId, usdOnlyPropId));
    const inactive = await quotePriceAlert({
      propertyId: usdOnlyPropId,
      currency: "XAF",
      context: {},
    });
    expect(inactive).toBeNull();
    await db
      .update(schema.rooms)
      .set({ isActive: true })
      .where(eq(schema.rooms.propertyId, usdOnlyPropId));
  });
});
