import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-154d (audit n°26, P2-4) — GET /api/properties/[id] expose en lecture
 * seule la TVA configurée (`taxRate`) et la réduction BestRewards réelle du
 * user courant (`bestrewardsDiscountPercent`), pour que l'aperçu de
 * réservation ne promette plus un montant différent du serveur.
 *
 * Additif : aucun champ existant modifié. `getCurrentUser` mocké ; la
 * persistance (propriété du seed + niveau user réel) est réelle.
 * Skip auto si la DB de test n'est pas accessible.
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
  const actual = await vi.importActual<typeof import("@/lib/auth")>(
    "@/lib/auth",
  );
  return { ...actual, getCurrentUser: vi.fn() };
});

dbTest("GET /api/properties/[id] — champs pricing additifs (T-154d)", () => {
  let GET: typeof import("./route").GET;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let customerId = "";
  let propertyId = "";
  let hostId = "";
  let createdPropertyId = "";

  beforeAll(async () => {
    const routeMod = await import("./route");
    GET = routeMod.GET;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<
      typeof vi.fn
    >;
    const { eq } = await import("drizzle-orm");
    const [customer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    if (!customer) throw new Error("Seed non appliqué (customer introuvable)");
    customerId = customer.id;
    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;
    // T-159 (audit n°29) : propriété dédiée NON-BestRewards pour rendre le
    // test indépendant du seed (« hotel-le-magnifique » est BR → 15+2=17) :
    // l'assertion « non-BR → 15 » testait en réalité un cas BR.
    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-159 Non-BR Test Property",
        slug: generateSlug(`t159-nonbr-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
        isBestrewards: false,
      })
      .returning();
    createdPropertyId = prop.id;
    propertyId = prop.id;
  });

  afterAll(async () => {
    const { eq: eqOp } = await import("drizzle-orm");
    if (createdPropertyId) {
      await db.delete(schema.properties).where(eqOp(schema.properties.id, createdPropertyId));
    }
  });

  it("anon → taxRate 0.1, bestrewardsDiscountPercent null (inchangé côté public)", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/properties") as never, {
      params: Promise.resolve({ id: propertyId }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.property.taxRate).toBe(0.1);
    expect(body.property.bestrewardsDiscountPercent).toBeNull();
  });

  it("customer niveau 2 (BestRewards 15 % par défaut, property non-BR) → 15", async () => {
    getCurrentUser.mockResolvedValue({ id: customerId, role: "customer" });
    const res = await GET(new Request("http://localhost/api/properties") as never, {
      params: Promise.resolve({ id: propertyId }),
    } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.property.taxRate).toBe(0.1);
    // Customer seed : bestrewards_level 2 → discounts[1] = 15.
    expect(body.property.bestrewardsDiscountPercent).toBe(15);
  });

  it("propriété seed BestRewards (level 2) → 15 + bonus 2 = 17", async () => {
    getCurrentUser.mockResolvedValue({ id: customerId, role: "customer" });
    const { eq: eqOp } = await import("drizzle-orm");
    const [seed] = await db
      .select()
      .from(schema.properties)
      .where(eqOp(schema.properties.slug, "hotel-le-magnifique"))
      .limit(1);
    const res = await GET(new Request("http://localhost/api/properties") as never, {
      params: Promise.resolve({ id: seed!.id }),
    } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.property.bestrewardsDiscountPercent).toBe(17);
  });

  it("le contrat existant reste présent (champs publics intacts)", async () => {
    // Contrat vérifié sur la propriété du seed (« hotel-le-magnifique »),
    // riche (rooms/ratePlans) — comme à l'origine du test.
    const { eq: eqOp } = await import("drizzle-orm");
    const [seed] = await db
      .select()
      .from(schema.properties)
      .where(eqOp(schema.properties.slug, "hotel-le-magnifique"))
      .limit(1);
    getCurrentUser.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/properties") as never, {
      params: Promise.resolve({ id: seed!.id }),
    } as never);
    const body = await res.json();
    expect(body.property.id).toBe(seed!.id);
    expect(body.property.name).toBeTruthy();
    expect(body.property.slug).toBe("hotel-le-magnifique");
    expect(body.rooms).toBeTruthy();
    expect(body.ratePlans).toBeTruthy();
  });
});
