import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * T-206/F2 + T-207 — lifecycle sans paiement plateforme :
 * - confirmation manuelle T-205 préservée pour les demandes sans intent PSP ;
 * - un ancien checkout en ligne non payé est neutralisé et redevient confirmable
 *   par l'hôte, car le paiement en ligne est désormais retiré ;
 * - clôture `completed` impossible tant que `paymentStatus !== paid`.
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

dbTest("T-206 — PUT /api/bookings/[id] garde paiement", () => {
  let PUT: typeof import("./route").PUT;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let customerId = "";
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];

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
        email: `t206-lifecycle-${Date.now()}@test.local`,
        firstName: "Life",
        lastName: "Cycle",
        role: "customer",
        language: "fr",
      })
      .returning();
    customerId = customer.id;

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-206 Lifecycle Property",
        slug: generateSlug(`t206-lifecycle-${Date.now()}`),
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
        name: "T-206 Lifecycle Room",
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
  });

  afterAll(async () => {
    for (const id of bookingIds) await db.delete(schema.bookings).where(eq(schema.bookings.id, id));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (customerId) await db.delete(schema.users).where(eq(schema.users.id, customerId));
  });

  async function insertBooking(overrides: Partial<typeof schema.bookings.$inferInsert> = {}) {
    const { generateBookingReference } = await import("@/lib/utils");
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId,
        status: "pending",
        checkIn: "2033-02-01",
        checkOut: "2033-02-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Life",
        guestLastName: "Cycle",
        guestEmail: `t206-lifecycle-${Date.now()}@test.local`,
        paymentStatus: "pending",
        subtotal: "200.00",
        taxes: "0",
        discount: "0",
        total: "200.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "30.00",
        netToHost: "170.00",
        ...overrides,
      })
      .returning();
    bookingIds.push(booking.id);
    return booking;
  }

  async function putStatus(id: string, status: string) {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    return PUT(
      new Request("http://localhost/api/bookings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      }) as never,
      { params: Promise.resolve({ id }) } as never,
    );
  }

  it("préserve la confirmation manuelle d'une demande sans paiement en ligne", async () => {
    const booking = await insertBooking({ paymentIntentId: null, paymentExpiresAt: null, paymentMethod: null });
    const res = await putStatus(booking.id, "confirmed");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { booking: { status: string; paymentStatus: string | null } };
    expect(body.booking.status).toBe("confirmed");
    expect(body.booking.paymentStatus).toBe("pending");
  });

  it("neutralise un ancien checkout en ligne non payé et confirme la demande sans PSP", async () => {
    const booking = await insertBooking({
      paymentIntentId: "pi_t206_unpaid",
      paymentMethod: "mock_card",
      paymentExpiresAt: new Date("2033-02-01T12:00:00.000Z"),
    });
    const res = await putStatus(booking.id, "confirmed");
    expect(res.status).toBe(200);
    const [row] = await db
      .select({
        status: schema.bookings.status,
        paymentIntentId: schema.bookings.paymentIntentId,
        paymentMethod: schema.bookings.paymentMethod,
        paymentExpiresAt: schema.bookings.paymentExpiresAt,
      })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, booking.id));
    expect(row.status).toBe("confirmed");
    expect(row.paymentIntentId).toBeNull();
    expect(row.paymentMethod).toBeNull();
    expect(row.paymentExpiresAt).toBeNull();
  });

  it("refuse completed sur séjour terminé mais non payé", async () => {
    const booking = await insertBooking({
      status: "confirmed",
      checkIn: "2026-01-01",
      checkOut: "2026-01-03",
      paymentStatus: "pending",
      paymentIntentId: null,
      paymentExpiresAt: null,
    });
    const res = await putStatus(booking.id, "completed");
    expect(res.status).toBe(409);
    const [row] = await db
      .select({ status: schema.bookings.status, loyaltyAwardedAt: schema.bookings.loyaltyAwardedAt })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, booking.id));
    expect(row.status).toBe("confirmed");
    expect(row.loyaltyAwardedAt).toBeNull();
  });
});
