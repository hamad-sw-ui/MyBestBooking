import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * T-206/F1/F12 — Calcul financier POST booking :
 * - en invité, aucune remise BestRewards invisible ;
 * - rate plan + promo cumulent bien leurs remises dans `bookings.discount` ;
 * - la promo est consommée une seule fois dans la transaction.
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

dbTest("T-206 — POST /api/bookings finance invité rate plan + promo", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let propId = "";
  let roomId = "";
  let ratePlanId = "";
  let promoId = "";
  let bookingId = "";
  let guestUserId = "";
  const code = `T206${Date.now().toString(36).toUpperCase()}`;
  const guestEmail = `t206-guest-${Date.now()}@test.local`;

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;
    getCurrentUser.mockResolvedValue(null);

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-206 Finance Property",
        slug: generateSlug(`t206-finance-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    propId = prop.id;

    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-206 Finance Room",
        roomType: "double",
        maxOccupancy: 4,
        maxAdults: 2,
        maxChildren: 2,
        basePrice: "100.00",
        currency: "EUR",
        quantity: 5,
        isActive: true,
      })
      .returning();
    roomId = room.id;

    const [plan] = await db
      .insert(schema.ratePlans)
      .values({
        roomId: room.id,
        name: "T-206 non refundable",
        type: "non_refundable",
        discountPercentage: "20.00",
        includesBreakfast: false,
        cancellationPolicy: "non_refundable",
        isActive: true,
      })
      .returning();
    ratePlanId = plan.id;

    const [promo] = await db
      .insert(schema.promotions)
      .values({
        code,
        name: "T-206 10 percent",
        type: "percentage",
        value: "10.00",
        minBookingAmount: "0.00",
        maxDiscount: null,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: new Date("2035-01-01T00:00:00.000Z"),
        maxUses: 5,
        currentUses: 0,
        isActive: true,
      })
      .returning();
    promoId = promo.id;
  });

  afterAll(async () => {
    if (bookingId) await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (guestUserId) await db.delete(schema.verificationTokens).where(eq(schema.verificationTokens.userId, guestUserId));
    if (guestUserId) await db.delete(schema.users).where(eq(schema.users.id, guestUserId));
    if (promoId) await db.delete(schema.promotions).where(eq(schema.promotions.id, promoId));
    if (ratePlanId) await db.delete(schema.ratePlans).where(eq(schema.ratePlans.id, ratePlanId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
  });

  it("cumule rate plan + promo et n'applique pas BestRewards à l'invité", async () => {
    const res = await POST(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: propId,
        roomId,
        ratePlanId,
        promoCode: code,
        checkIn: "2033-01-10",
        checkOut: "2033-01-12",
        numAdults: 2,
        numChildren: 1,
        guestFirstName: "Guest",
        guestLastName: "Finance",
        guestEmail,
        guestCountry: "FR",
        isGuestBooking: true,
      }),
    }) as never);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { booking: { id: string; userId: string; subtotal: string; taxes: string; discount: string; total: string; status: string }; manualConfirmation?: boolean };
    bookingId = body.booking.id;
    guestUserId = body.booking.userId;

    expect(body.manualConfirmation).toBe(true);
    expect(body.booking.status).toBe("pending");
    expect(Number(body.booking.subtotal)).toBe(160);

    const ratePlanDiscount = 40;
    const promoDiscount = Math.round((Number(body.booking.subtotal) + Number(body.booking.taxes)) * 0.10 * 100) / 100;
    const expectedDiscount = ratePlanDiscount + promoDiscount;
    const expectedTotal = Math.round((Number(body.booking.subtotal) + Number(body.booking.taxes) - promoDiscount) * 100) / 100;

    expect(Number(body.booking.discount)).toBe(expectedDiscount);
    expect(Number(body.booking.total)).toBe(expectedTotal);

    const [promo] = await db
      .select({ currentUses: schema.promotions.currentUses })
      .from(schema.promotions)
      .where(eq(schema.promotions.id, promoId))
      .limit(1);
    expect(promo.currentUses).toBe(1);
  });
});
