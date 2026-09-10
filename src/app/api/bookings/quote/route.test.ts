import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-205 — GET /api/bookings/quote : le récap checkout doit refléter les prix
 * journaliers du calendrier utilisés par POST /api/bookings, pas seulement
 * rooms.basePrice × nuits. Test DB-gated comme les autres routes métier.
 */

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

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

dbTest("GET /api/bookings/quote — prix calendrier (T-205)", () => {
  let GET: typeof import("./route").GET;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let propertyId = "";
  let roomId = "";
  let ratePlanId = "";

  beforeAll(async () => {
    const routeMod = await import("./route");
    GET = routeMod.GET;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;
    getCurrentUser.mockResolvedValue(null);

    const { generateSlug } = await import("@/lib/utils");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const [host] = await db.insert(schema.users).values({
      email: `quote-host-${suffix}@test.local`,
      firstName: "Quote",
      lastName: "Host",
      role: "host",
      emailVerified: true,
      approvalStatus: "approved",
    }).returning();
    hostId = host.id;

    const [property] = await db.insert(schema.properties).values({
      hostId,
      name: "Test Quote Property",
      slug: generateSlug(`test-quote-${suffix}`),
      type: "hotel",
      city: "Paris",
      country: "FR",
      status: "active",
    }).returning();
    propertyId = property.id;

    const [room] = await db.insert(schema.rooms).values({
      propertyId,
      name: "Quote Room",
      roomType: "double",
      maxOccupancy: 2,
      maxAdults: 2,
      maxChildren: 0,
      quantity: 1,
      basePrice: "100.00",
      currency: "EUR",
      isActive: true,
    }).returning();
    roomId = room.id;

    const [plan] = await db.insert(schema.ratePlans).values({
      roomId,
      name: "Non remboursable",
      type: "non_refundable",
      discountPercentage: "10.00",
      cancellationPolicy: "non_refundable",
      isActive: true,
    }).returning();
    ratePlanId = plan.id;

    await db.insert(schema.roomAvailability).values([
      { roomId, date: "2027-11-10", availableCount: 1, price: "120.00", stopSell: false, minStay: 1 },
      { roomId, date: "2027-11-11", availableCount: 1, price: "80.00", stopSell: false, minStay: 1 },
    ]);
  });

  afterAll(async () => {
    const { eq } = await import("drizzle-orm");
    if (roomId) await db.delete(schema.roomAvailability).where(eq(schema.roomAvailability.roomId, roomId));
    if (ratePlanId) await db.delete(schema.ratePlans).where(eq(schema.ratePlans.id, ratePlanId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propertyId) await db.delete(schema.properties).where(eq(schema.properties.id, propertyId));
    if (hostId) await db.delete(schema.users).where(eq(schema.users.id, hostId));
  });

  it("renvoie le sous-total des prix journaliers, puis remise rate plan et TVA", async () => {
    const params = new URLSearchParams({
      propertyId,
      roomId,
      checkIn: "2027-11-10",
      checkOut: "2027-11-12",
      numAdults: "2",
      numChildren: "0",
      ratePlanId,
    });
    const res = await GET(new Request(`http://localhost/api/bookings/quote?${params.toString()}`) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      currency: "EUR",
      nights: ["2027-11-10", "2027-11-11"],
      nightlyPrices: [120, 80],
      baseSubtotal: 200,
      ratePlanDiscount: 20,
      subtotal: 180,
      taxes: 18,
      totalBeforePromo: 198,
      totalBeforeWallet: 198,
    });
  });

  it("refuse une nuit stop-sell avec le même statut que la création", async () => {
    const { and, eq } = await import("drizzle-orm");
    await db.update(schema.roomAvailability)
      .set({ stopSell: true })
      .where(and(eq(schema.roomAvailability.roomId, roomId), eq(schema.roomAvailability.date, "2027-11-11")));

    const params = new URLSearchParams({
      propertyId,
      roomId,
      checkIn: "2027-11-10",
      checkOut: "2027-11-12",
      numAdults: "2",
      numChildren: "0",
    });
    const res = await GET(new Request(`http://localhost/api/bookings/quote?${params.toString()}`) as never);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(String(body.error)).toContain("disponible");
  });
});
