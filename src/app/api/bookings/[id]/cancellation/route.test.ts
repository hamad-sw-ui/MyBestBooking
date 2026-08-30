import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-156 (audit n°29) — GET /api/bookings/[id]/cancellation : devis par
 * acteur. Hôte du bien / admin → 200 avec { actor, fullRefund: true } et
 * fee 0 ; voyageur → grille de politique (champ actor absent) ; tiers →
 * 403. Intégration DB réelle (skip si indisponible), auth mockée.
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("T-156 — devis d'annulation par acteur", () => {
  let GET: typeof import("./route").GET;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let adminId = "";
  let customerId = "";
  let otherHostId = "";
  let bookingId = "";

  beforeAll(async () => {
    const routeMod = await import("./route");
    GET = routeMod.GET;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;
    const { eq } = await import("drizzle-orm");

    const seedId = async (email: string) => {
      const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      if (!u) throw new Error("Seed non appliqué");
      return u.id;
    };
    hostId = await seedId("host@mybestbooking.com");
    adminId = await seedId("admin@mybestbooking.com");
    customerId = await seedId("customer@mybestbooking.com");

    const [otherHost] = await db
      .insert(schema.users)
      .values({
        email: `other-host-${Date.now()}@test.local`,
        firstName: "Other",
        lastName: "Host",
        role: "host",
      })
      .returning();
    otherHostId = otherHost.id;

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-156 Quote Test Property",
        slug: generateSlug(`t156-quote-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
        cancellationPolicy: "non_refundable",
      })
      .returning();
    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-156 Quote Test Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        quantity: 5,
        isActive: true,
        currency: "EUR",
      })
      .returning();
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: prop.id,
        roomId: room.id,
        status: "confirmed",
        checkIn: "2099-05-01",
        checkOut: "2099-05-05",
        numNights: 4,
        numAdults: 2,
        guestFirstName: "Quote",
        guestLastName: "Test",
        guestEmail: "quote@test.local",
        subtotal: "500.00",
        total: "500.00",
        currency: "EUR",
        paymentStatus: "unpaid",
        commissionRate: "15.00",
        commissionAmount: "75.00",
        netToHost: "425.00",
        ratePlanSnapshot: { cancellationPolicy: "non_refundable", cancellationFreeDays: 0 },
      })
      .returning();
    bookingId = booking.id;
  });

  afterAll(async () => {
    const { eq } = await import("drizzle-orm");
    if (bookingId) {
      const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId)).limit(1);
      if (b) {
        await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
        await db.delete(schema.rooms).where(eq(schema.rooms.id, b.roomId));
        await db.delete(schema.properties).where(eq(schema.properties.id, b.propertyId));
      }
    }
    if (otherHostId) await db.delete(schema.users).where(eq(schema.users.id, otherHostId));
  });

  async function quoteAs(user: { id: string; role: string }): Promise<Response> {
    getCurrentUser.mockResolvedValue(user);
    const req = new Request("http://localhost/api/bookings/x/cancellation", { method: "GET" });
    return GET(req as any, { params: Promise.resolve({ id: bookingId }) } as any);
  }

  it("hôte du bien → 200, actor=host, fullRefund, fee 0", async () => {
    const res = await quoteAs({ id: hostId, role: "host" });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.actor).toBe("host");
    expect(j.fullRefund).toBe(true);
    expect(j.cancellationFee).toBe("0.00");
    expect(j.estimatedRefund).toBe("500.00");
  });

  it("admin → 200, actor=admin, fullRefund, fee 0", async () => {
    const res = await quoteAs({ id: adminId, role: "admin" });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.actor).toBe("admin");
    expect(j.fullRefund).toBe(true);
    expect(j.cancellationFee).toBe("0.00");
  });

  it("voyageur → 200, grille appliquée, aucun champ actor (contrat inchangé)", async () => {
    const res = await quoteAs({ id: customerId, role: "customer" });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.actor).toBeUndefined();
    expect(j.fullRefund).toBeUndefined();
    expect(j.cancellationFee).toBe("500.00");
    expect(j.estimatedRefund).toBe("0.00");
  });

  it("hôte d'un autre bien → 403", async () => {
    const res = await quoteAs({ id: otherHostId, role: "host" });
    expect(res.status).toBe(403);
  });
});
