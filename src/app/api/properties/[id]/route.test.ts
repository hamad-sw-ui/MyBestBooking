import { describe, it, expect, beforeAll, vi } from "vitest";

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
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.slug, "hotel-le-magnifique"))
      .limit(1);
    if (!property) throw new Error("Seed non appliqué (property introuvable)");
    propertyId = property.id;
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

  it("le contrat existant reste présent (champs publics intacts)", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/properties") as never, {
      params: Promise.resolve({ id: propertyId }),
    } as never);
    const body = await res.json();
    expect(body.property.id).toBe(propertyId);
    expect(body.property.name).toBeTruthy();
    expect(body.property.slug).toBe("hotel-le-magnifique");
    expect(body.rooms).toBeTruthy();
    expect(body.ratePlans).toBeTruthy();
  });
});
