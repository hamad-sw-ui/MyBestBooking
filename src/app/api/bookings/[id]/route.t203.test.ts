import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * T-203 — Paiement manuel : l'hôte (ou l'admin) peut constater le paiement sur
 * place via `PUT /api/bookings/[id] { markPaidOffline: true }` →
 * `paymentStatus:"paid"` + `paymentMethodOffline:true`. Le client ne peut pas ;
 * une réservation annulée/no-show renvoie 409.
 *
 * Test d'intégration (DB de test) : l'auth est mockée, la persistance réelle.
 * Property/room/booking créés puis nettoyés.
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

dbTest("T-203 — PUT /api/bookings/[id] markPaidOffline (paiement sur place)", () => {
  let PUT: typeof import("./route").PUT;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let customerId = "";
  let customerEmail = "";
  let propId = "";
  let roomId = "";
  let bookingId = "";

  beforeAll(async () => {
    const routeMod = await import("./route");
    PUT = routeMod.PUT;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;

    const [customer] = await db
      .insert(schema.users)
      .values({
        email: `t203-payoffline-${Date.now()}@test.local`,
        firstName: "Pay",
        lastName: "Offline",
        role: "customer",
        language: "fr",
      })
      .returning();
    customerId = customer.id;
    customerEmail = customer.email;

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-203 PayOffline Property",
        slug: generateSlug(`t203-payoffline-${Date.now()}`),
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
        name: "T-203 PayOffline Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        currency: "EUR",
        quantity: 5,
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
        checkIn: "2032-05-01",
        checkOut: "2032-05-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Pay",
        guestLastName: "Offline",
        guestEmail: customer.email,
        paymentStatus: "pending",
        paymentIntentId: null,
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

  it("hôte constate le paiement sur place → paid + paymentMethodOffline", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const res = await PUT(
      new Request("http://localhost/api/bookings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markPaidOffline: true }),
      }) as never,
      { params: Promise.resolve({ id: bookingId }) } as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { booking: { paymentStatus: string; paymentMethodOffline: boolean; paymentMethod: string | null; paymentExpiresAt: string | null } };
    expect(body.booking.paymentStatus).toBe("paid");
    expect(body.booking.paymentMethodOffline).toBe(true);
    expect(body.booking.paymentMethod).toBe("offline");
    expect(body.booking.paymentExpiresAt).toBeNull();
  });

  it("idempotent : rappeler ne casse pas (déjà paid)", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const res = await PUT(
      new Request("http://localhost/api/bookings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markPaidOffline: true }),
      }) as never,
      { params: Promise.resolve({ id: bookingId }) } as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { booking: { paymentStatus: string; paymentMethodOffline: boolean } };
    expect(body.booking.paymentStatus).toBe("paid");
    expect(body.booking.paymentMethodOffline).toBe(true);
  });

  it("le client (non-hôte) ne peut pas constater le paiement sur place → 403", async () => {
    // Booking #2 pour ce cas, encore pending.
    const { generateBookingReference } = await import("@/lib/utils");
    const [b2] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId: roomId,
        status: "confirmed",
        checkIn: "2032-06-01",
        checkOut: "2032-06-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Pay",
        guestLastName: "Offline",
        guestEmail: customerEmail,
        paymentStatus: "pending",
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
    const b2Id = b2.id;
    try {
      getCurrentUser.mockResolvedValue({ id: customerId, role: "customer" });
      const res = await PUT(
        new Request("http://localhost/api/bookings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ markPaidOffline: true }),
        }) as never,
        { params: Promise.resolve({ id: b2Id }) } as never,
      );
      expect(res.status).toBe(403);
    } finally {
      await db.delete(schema.bookings).where(eq(schema.bookings.id, b2Id));
    }
  });

  it("réservation annulée → 409 (impossible de constater un paiement)", async () => {
    const { generateBookingReference } = await import("@/lib/utils");
    const [b3] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId: roomId,
        status: "cancelled",
        checkIn: "2032-07-01",
        checkOut: "2032-07-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Pay",
        guestLastName: "Offline",
        guestEmail: customerEmail,
        paymentStatus: "pending",
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
    const b3Id = b3.id;
    try {
      getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
      const res = await PUT(
        new Request("http://localhost/api/bookings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ markPaidOffline: true }),
        }) as never,
        { params: Promise.resolve({ id: b3Id }) } as never,
      );
      expect(res.status).toBe(409);
    } finally {
      await db.delete(schema.bookings).where(eq(schema.bookings.id, b3Id));
    }
  });
});
