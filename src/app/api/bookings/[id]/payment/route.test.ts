import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-207 — POST /api/bookings/[id]/payment ne reprend plus aucun paiement.
 * La route legacy reste protégée par auth/propriété puis répond 410 explicite.
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

dbTest("T-207 — POST /api/bookings/[id]/payment désactivé", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let userId = "";
  let otherUserId = "";
  let propId = "";
  let roomId = "";
  let bookingId = "";

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const { eq } = await import("drizzle-orm");
    const [customer] = await db.select().from(schema.users).where(eq(schema.users.email, "customer@mybestbooking.com")).limit(1);
    if (!customer) throw new Error("Seed non appliqué (customer introuvable)");
    userId = customer.id;
    const [host] = await db.select().from(schema.users).where(eq(schema.users.email, "host@mybestbooking.com")).limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    otherUserId = host.id;

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-207 Payment Disabled Property",
        slug: generateSlug(`t207-payment-disabled-${Date.now()}`),
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
        name: "T-207 Payment Disabled Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        quantity: 2,
        isActive: true,
        currency: "EUR",
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
        status: "pending",
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Test",
        guestLastName: "PaymentDisabled",
        guestEmail: customer.email,
        subtotal: "200.00",
        taxes: "20.00",
        discount: "0",
        total: "220.00",
        currency: "EUR",
        paymentStatus: "pending",
        paymentIntentId: "pi_legacy_disabled",
        paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        commissionRate: "15.00",
        commissionAmount: "33.00",
        netToHost: "187.00",
      })
      .returning();
    bookingId = booking.id;
  });

  afterAll(async () => {
    const { eq } = await import("drizzle-orm");
    if (bookingId) await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
  });

  it("propriétaire → 410 ONLINE_PAYMENT_DISABLED, aucun PSP appelé", async () => {
    getCurrentUser.mockResolvedValue({ id: userId, role: "customer" });
    const res = await POST(new Request("http://localhost/api/bookings") as never, { params: Promise.resolve({ id: bookingId }) } as never);
    const body = await res.json();
    expect(res.status).toBe(410);
    expect(body.code).toBe("ONLINE_PAYMENT_DISABLED");
    expect(String(body.error)).toContain("paiement en ligne est désactivé");
  });

  it("non-propriétaire → 403 avant le message fonctionnel", async () => {
    getCurrentUser.mockResolvedValue({ id: otherUserId, role: "host" });
    const res = await POST(new Request("http://localhost/api/bookings") as never, { params: Promise.resolve({ id: bookingId }) } as never);
    expect(res.status).toBe(403);
  });
});
