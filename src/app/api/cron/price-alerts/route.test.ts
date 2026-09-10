import { describe, it, expect, beforeAll, afterAll } from "vitest";

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
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

dbTest("T-209/F1 — expiration des demandes de réservation manuelles", () => {
  let expireManualBookingRequests: typeof import("./route").expireManualBookingRequests;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let customerId = "";
  let hostId = "";
  let propId = "";
  let roomId = "";
  let promoId = "";
  const bookingIds: string[] = [];

  beforeAll(async () => {
    expireManualBookingRequests = (await import("./route")).expireManualBookingRequests;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [host] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "host@mybestbooking.com")).limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;
    const [customer] = await db.insert(schema.users).values({
      email: `t209-expire-${Date.now()}@test.local`,
      firstName: "Expire",
      lastName: "Request",
      role: "customer",
      walletBalance: "10.00",
      language: "fr",
    }).returning();
    customerId = customer.id;
    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db.insert(schema.properties).values({
      hostId,
      name: "T-209 Expiration Property",
      slug: generateSlug(`t209-expiration-${Date.now()}`),
      type: "hotel",
      city: "TestCity",
      country: "FR",
      status: "active",
    }).returning();
    propId = prop.id;
    const [room] = await db.insert(schema.rooms).values({
      propertyId: propId,
      name: "T-209 Expiration Room",
      roomType: "double",
      maxOccupancy: 2,
      maxAdults: 2,
      basePrice: "100.00",
      currency: "EUR",
      quantity: 1,
      isActive: true,
    }).returning();
    roomId = room.id;
    const [promo] = await db.insert(schema.promotions).values({
      code: `T209EXP${Date.now().toString(36).toUpperCase()}`,
      name: "T-209 request expiration",
      type: "percentage",
      value: "10.00",
      validFrom: new Date("2020-01-01"),
      validUntil: new Date("2099-01-01"),
      maxUses: 100,
      currentUses: 1,
      isActive: true,
    }).returning();
    promoId = promo.id;
  });

  afterAll(async () => {
    if (!db || !schema) return;
    const { eq, inArray } = await import("drizzle-orm");
    if (bookingIds.length) await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    if (promoId) await db.delete(schema.promotions).where(eq(schema.promotions.id, promoId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (customerId) await db.delete(schema.users).where(eq(schema.users.id, customerId));
  });

  async function insertBooking(partial: Partial<typeof schema.bookings.$inferInsert>) {
    const [booking] = await db.insert(schema.bookings).values({
      bookingReference: `T209EXP${Date.now().toString(36).toUpperCase()}${bookingIds.length}`.slice(0, 20),
      userId: customerId,
      propertyId: propId,
      roomId,
      status: "pending",
      paymentStatus: "pending",
      checkIn: "2031-09-01",
      checkOut: "2031-09-03",
      numNights: 2,
      numAdults: 1,
      numChildren: 0,
      guestFirstName: "Expire",
      guestLastName: "Request",
      guestEmail: "expire-request@test.local",
      guestCountry: "FR",
      subtotal: "200.00",
      taxes: "20.00",
      fees: "0.00",
      discount: "0.00",
      total: "220.00",
      currency: "EUR",
      commissionRate: "15.00",
      commissionAmount: "33.00",
      netToHost: "187.00",
      ...partial,
    }).returning();
    bookingIds.push(booking.id);
    return booking;
  }

  it("annule seulement les demandes manuelles expirées et libère les avantages", async () => {
    // Date de test volontairement ancienne : elle évite d'expirer les demandes
    // créées par d'autres validations runtime dans la base partagée.
    const now = new Date("2020-01-02T12:00:00.000Z");
    const expired = await insertBooking({
      requestExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      promotionId: promoId,
      walletCreditsUsed: "7.00",
    });
    const future = await insertBooking({ requestExpiresAt: new Date("2020-01-03T00:00:00.000Z") });
    const legacyHold = await insertBooking({
      paymentIntentId: "pi_legacy_hold",
      paymentExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      requestExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    const count = await expireManualBookingRequests(now);
    expect(count).toBe(1);

    const { eq } = await import("drizzle-orm");
    const [expiredAfter] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, expired.id));
    const [futureAfter] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, future.id));
    const [legacyAfter] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, legacyHold.id));
    const [promoAfter] = await db.select({ currentUses: schema.promotions.currentUses }).from(schema.promotions).where(eq(schema.promotions.id, promoId));
    const [userAfter] = await db.select({ walletBalance: schema.users.walletBalance }).from(schema.users).where(eq(schema.users.id, customerId));

    expect(expiredAfter.status).toBe("cancelled");
    expect(expiredAfter.requestExpiresAt).toBeNull();
    expect(expiredAfter.benefitsReleasedAt?.toISOString()).toBe(now.toISOString());
    expect(expiredAfter.cancellationReason).toContain("Demande de réservation expirée");
    expect(futureAfter.status).toBe("pending");
    expect(legacyAfter.status).toBe("pending");
    expect(Number(promoAfter.currentUses)).toBe(0);
    expect(Number(userAfter.walletBalance)).toBeCloseTo(17, 2);
  });
});
