import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Test d'intégration PUT /api/bookings/[id] — T-154b (audit n°26, P1-3) :
 * la clôture d'un séjour (« Terminer le séjour », status "completed") doit
 * convertir le cashback BestRewards dans la devise de la réservation
 * (4e argument `currency` transmis à `calculateLoyaltyAward`), comme le fait
 * déjà le cron (T-153 C). Sans cela, 500 $US → 25,00 € au lieu de 23,15 €.
 *
 * `getCurrentUser` est mocké (next/headers indisponible en test node) ; la
 * persistance réelle : property/room/booking créés puis supprimés, état
 * BestRewards du customer restauré en afterAll. Skip si DB inaccessible.
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

dbTest("T-154b — PUT /api/bookings/[id] completed (cashback converti)", () => {
  let PUT: typeof import("./route").PUT;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let customerId = "";
  let hostId = "";
  let propId = "";
  let roomId = "";
  let bookingId = "";
  const customerState = {
    bestrewardsLevel: 2,
    bestrewardsBookingsCount: 7,
    walletBalance: "25.00",
  };

  beforeAll(async () => {
    const routeMod = await import("./route");
    PUT = routeMod.PUT;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<
      typeof vi.fn
    >;

    const [customer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    if (!customer) throw new Error("Seed non appliqué (customer introuvable)");
    customerId = customer.id;
    customerState.bestrewardsLevel = customer.bestrewardsLevel ?? 2;
    customerState.bestrewardsBookingsCount = customer.bestrewardsBookingsCount ?? 0;
    customerState.walletBalance = customer.walletBalance ?? "25.00";
    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;

    const { generateSlug, generateBookingReference } = await import(
      "@/lib/utils"
    );
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-154b Cashback Test Property",
        slug: generateSlug(`t154b-cashback-${Date.now()}`),
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
        name: "T-154b Cashback Test Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        quantity: 2,
        isActive: true,
        currency: "USD",
      })
      .returning();
    roomId = room.id;

    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customer.id,
        propertyId: prop.id,
        roomId: room.id,
        status: "confirmed",
        checkIn: "2026-08-20",
        checkOut: "2026-08-22",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Test",
        guestLastName: "Cashback",
        guestEmail: customer.email,
        subtotal: "200.00",
        taxes: "0",
        discount: "0",
        total: "200.00",
        currency: "USD",
        paymentStatus: "paid",
        commissionRate: "15.00",
        commissionAmount: "30.00",
        netToHost: "170.00",
      })
      .returning();
    bookingId = booking.id;
  });

  afterAll(async () => {
    const { eq } = await import("drizzle-orm");
    if (bookingId) await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    await db
      .update(schema.users)
      .set({
        bestrewardsLevel: customerState.bestrewardsLevel,
        bestrewardsBookingsCount: customerState.bestrewardsBookingsCount,
        walletBalance: customerState.walletBalance,
      })
      .where(eq(schema.users.id, customerId));
  });

  it("séjour USD 200,00 clôturé → cashback 9,26 EUR (pas 10,00)", async () => {
    // Niveau Ambassador (3) pour que le cashback soit acquis.
    await db
      .update(schema.users)
      .set({
        bestrewardsLevel: 3,
        bestrewardsBookingsCount: 15,
        walletBalance: "50.00",
      })
      .where(eq(schema.users.id, customerId));

    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const res = await PUT(new Request("http://localhost/api/bookings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    }) as never, { params: Promise.resolve({ id: bookingId }) } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.booking?.status).toBe("completed");
    expect(body.booking?.cashbackAmount).toBe("9.26");

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, customerId));
    expect(user.walletBalance).toBe("59.26");
    expect(user.bestrewardsBookingsCount).toBe(16);
    expect(user.bestrewardsLevel).toBe(3);
  });

  it("séjour EUR inchangé : 200,00 € → cashback 10,00 €", async () => {
    await db
      .update(schema.users)
      .set({
        bestrewardsLevel: 3,
        bestrewardsBookingsCount: 15,
        walletBalance: "50.00",
      })
      .where(eq(schema.users.id, customerId));
    await db
      .update(schema.bookings)
      .set({ currency: "EUR", total: "200.00", cashbackAmount: null, loyaltyAwardedAt: null })
      .where(eq(schema.bookings.id, bookingId));

    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const res = await PUT(new Request("http://localhost/api/bookings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    }) as never, { params: Promise.resolve({ id: bookingId }) } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.booking?.cashbackAmount).toBe("10.00");

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, customerId));
    expect(user.walletBalance).toBe("60.00");
  });
});
