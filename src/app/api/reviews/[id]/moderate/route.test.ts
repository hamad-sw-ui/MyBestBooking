import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * Test d'intégration PATCH /api/reviews/[id]/moderate — T-023.
 * DB-backed via embedded-postgres (55432). Skip si DB non accessible.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const p = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const c = await p.connect();
  await c.query("SELECT 1");
  c.release();
  await p.end();
  dbAvailable = true;
} catch {}

const dbTest = dbAvailable ? describe : describe.skip;

async function makeReq(id: string, body: unknown) {
  const { NextRequest } = await import("next/server");
  return {
    request: new NextRequest(`http://x/api/reviews/${id}/moderate`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

dbTest("PATCH /api/reviews/[id]/moderate (T-023)", () => {
  let PATCH: typeof import("./route").PATCH;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let hostId: string;
  let customerId: string;
  let propertyId: string;
  let roomId: string;
  let bookingId: string;
  let reviewId: string;
  let previousAverageRating: string;
  let previousTotalReviews: number;

  beforeAll(async () => {
    // Auth mock : setup admin user for this test
    vi.doMock("@/lib/auth", async () => {
      const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
      return {
        ...actual,
        getCurrentUser: async () => currentMockUser,
      };
    });

    const mod = await import("./route");
    PATCH = mod.PATCH;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");

    // Prépare : un host, un customer, une property, une room, un booking,
    // un avis vérifié 9/10.
    const [h] = await db.insert(schema.users).values({
      email: `host-mod-${Date.now()}@t.co`,
      firstName: "Host", lastName: "Mod", role: "host",
    }).returning({ id: schema.users.id });
    hostId = h.id;
    const [c] = await db.insert(schema.users).values({
      email: `cust-mod-${Date.now()}@t.co`,
      firstName: "Cust", lastName: "Mod", role: "customer",
    }).returning({ id: schema.users.id });
    customerId = c.id;

    const [p] = await db.insert(schema.properties).values({
      hostId, name: "P Mod", slug: `p-mod-${Date.now()}`,
      type: "hotel", description: "d",
      addressLine: "1", city: "Yaoundé", country: "CM",
      status: "active", averageRating: "0", totalReviews: 0,
    }).returning({ id: schema.properties.id });
    propertyId = p.id;

    const [r] = await db.insert(schema.rooms).values({
      propertyId, name: "R", roomType: "standard",
      maxOccupancy: 2, maxAdults: 2,
      basePrice: "100", currency: "XAF", quantity: 1,
    }).returning({ id: schema.rooms.id });
    roomId = r.id;

    const [b] = await db.insert(schema.bookings).values({
      bookingReference: `MOD-${Date.now()}`,
      userId: customerId, propertyId, roomId,
      status: "completed", checkIn: "2026-01-01", checkOut: "2026-01-03",
      numNights: 2, numAdults: 1,
      guestFirstName: "C", guestLastName: "M", guestEmail: "c@t.co",
      subtotal: "200", taxes: "20", total: "220", currency: "XAF",
      paymentStatus: "paid", paymentMethod: "card",
      commissionRate: "15", commissionAmount: "33", netToHost: "187",
    }).returning({ id: schema.bookings.id });
    bookingId = b.id;

    const [rv] = await db.insert(schema.reviews).values({
      bookingId, userId: customerId, propertyId,
      overallRating: "9.0", status: "approved",
      positiveComment: "Excellent",
    }).returning({ id: schema.reviews.id });
    reviewId = rv.id;

    // Force le recalcul initial de averageRating comme POST /api/reviews.
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      UPDATE properties SET
        average_rating = COALESCE((SELECT ROUND(AVG(overall_rating)::numeric, 1) FROM reviews WHERE property_id=${propertyId} AND status='approved'), 0),
        total_reviews = COALESCE((SELECT COUNT(*)::int FROM reviews WHERE property_id=${propertyId} AND status='approved'), 0)
      WHERE properties.id = ${propertyId};
    `);
    const [propAfter] = await db.select().from(schema.properties).where(sql`id=${propertyId}`);
    previousAverageRating = propAfter.averageRating ?? "0";
    previousTotalReviews = propAfter.totalReviews ?? 0;
  });

  afterAll(async () => {
    if (reviewId) await db.delete(schema.reviews).where((await import("drizzle-orm")).eq(schema.reviews.id, reviewId));
    if (bookingId) await db.delete(schema.bookings).where((await import("drizzle-orm")).eq(schema.bookings.id, bookingId));
    if (roomId) await db.delete(schema.rooms).where((await import("drizzle-orm")).eq(schema.rooms.id, roomId));
    if (propertyId) await db.delete(schema.properties).where((await import("drizzle-orm")).eq(schema.properties.id, propertyId));
    if (customerId) await db.delete(schema.users).where((await import("drizzle-orm")).eq(schema.users.id, customerId));
    if (hostId) await db.delete(schema.users).where((await import("drizzle-orm")).eq(schema.users.id, hostId));
    vi.doUnmock("@/lib/auth");
  });

  let currentMockUser: { id: string; email: string; role: string } | null = null;

  it("non-admin (customer) → 403", async () => {
    currentMockUser = { id: customerId, email: "c@t.co", role: "customer" };
    const { request, ctx } = await makeReq(reviewId, { status: "hidden" });
    const res = await PATCH(request, ctx);
    expect(res.status).toBe(403);
  });

  it("admin sur review inconnue → 404", async () => {
    currentMockUser = { id: hostId, email: "a@t.co", role: "admin" };
    const { request, ctx } = await makeReq("00000000-0000-0000-0000-000000000000", { status: "hidden" });
    const res = await PATCH(request, ctx);
    expect(res.status).toBe(404);
  });

  it("admin refuse un status invalide → 400 Zod", async () => {
    currentMockUser = { id: hostId, email: "a@t.co", role: "admin" };
    const { request, ctx } = await makeReq(reviewId, { status: "foobar" });
    const res = await PATCH(request, ctx);
    expect(res.status).toBe(400);
  });

  it("admin approved → hidden : recalcul averageRating vers 0", async () => {
    currentMockUser = { id: hostId, email: "a@t.co", role: "admin" };
    expect(previousTotalReviews).toBe(1);
    expect(parseFloat(previousAverageRating)).toBeGreaterThan(0);

    const { request, ctx } = await makeReq(reviewId, { status: "hidden" });
    const res = await PATCH(request, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.review.status).toBe("hidden");

    const { sql, eq } = await import("drizzle-orm");
    const [prop] = await db.select().from(schema.properties).where(eq(schema.properties.id, propertyId));
    expect(prop.totalReviews).toBe(0);
    expect(parseFloat(prop.averageRating ?? "0")).toBe(0);
  });

  it("admin hidden → approved : moyenne remonte", async () => {
    currentMockUser = { id: hostId, email: "a@t.co", role: "admin" };
    const { request, ctx } = await makeReq(reviewId, { status: "approved" });
    const res = await PATCH(request, ctx);
    expect(res.status).toBe(200);

    const { eq } = await import("drizzle-orm");
    const [prop] = await db.select().from(schema.properties).where(eq(schema.properties.id, propertyId));
    expect(prop.totalReviews).toBe(1);
    expect(parseFloat(prop.averageRating ?? "0")).toBeCloseTo(9.0, 1);
  });
});
