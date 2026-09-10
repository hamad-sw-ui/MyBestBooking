import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/** T-206/F10 — suppression compte bloquée en présence d'obligations actives. */

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

dbTest("T-206 — DELETE /api/users/me obligations actives", () => {
  let DELETE: typeof import("./route").DELETE;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let customerId = "";
  let propId = "";
  let roomId = "";
  let bookingId = "";

  beforeAll(async () => {
    const routeMod = await import("./route");
    DELETE = routeMod.DELETE;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const [host] = await db.select().from(schema.users).where(eq(schema.users.email, "host@mybestbooking.com")).limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;

    const [customer] = await db
      .insert(schema.users)
      .values({
        email: `t206-delete-active-${Date.now()}@test.local`,
        firstName: "Delete",
        lastName: "Blocked",
        role: "customer",
        language: "fr",
      })
      .returning();
    customerId = customer.id;

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-206 Delete Property",
        slug: generateSlug(`t206-delete-${Date.now()}`),
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
        name: "T-206 Delete Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        currency: "EUR",
        quantity: 2,
        isActive: true,
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
        checkIn: "2033-04-01",
        checkOut: "2033-04-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Delete",
        guestLastName: "Blocked",
        guestEmail: customer.email,
        paymentStatus: "paid",
        subtotal: "200.00",
        taxes: "0",
        discount: "0",
        total: "200.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "30.00",
        netToHost: "170.00",
      })
      .returning();
    bookingId = booking.id;
  });

  afterAll(async () => {
    if (bookingId) await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (customerId) await db.delete(schema.users).where(eq(schema.users.id, customerId));
  });

  it("retourne 409 et n'anonymise pas un client avec réservation active", async () => {
    getCurrentUser.mockResolvedValue({
      id: customerId,
      role: "customer",
      email: `t206-delete-active-${Date.now()}@test.local`,
    });
    const res = await DELETE();
    expect(res.status).toBe(409);
    const [row] = await db
      .select({ deletedAt: schema.users.deletedAt })
      .from(schema.users)
      .where(eq(schema.users.id, customerId));
    expect(row.deletedAt).toBeNull();
  });
});
