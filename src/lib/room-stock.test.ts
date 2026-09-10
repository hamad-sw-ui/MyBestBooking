import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { remainingStock } from "@/lib/room-stock-rules";

/**
 * T-244 (audit n°4, constat N3) — stock affiché vs stock vendable.
 *
 * `remainingStock` est purement calculé (borne au stock déclaré ET à la
 * capacité, jamais négatif) ; `loadBookedCounts` applique la règle du tunnel
 * de réservation (`d >= check_in AND d < check_out`, hors `cancelled`) sur des
 * séjours réels.
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

describe("T-244 — remainingStock (calcul pur)", () => {
  it("déduit les séjours du stock déclaré", () => {
    expect(remainingStock(2, 2, 1)).toBe(1);
    expect(remainingStock(5, 5, 5)).toBe(0);
  });

  it("borne au stock déclaré comme à la capacité", () => {
    // Stock déclaré supérieur à la capacité : la capacité fait foi.
    expect(remainingStock(99, 3, 0)).toBe(3);
    // Stock déclaré inférieur : le stock saisi fait foi.
    expect(remainingStock(1, 8, 0)).toBe(1);
  });

  it("ne descend jamais sous zéro (survente héritée, données incohérentes)", () => {
    expect(remainingStock(2, 2, 3)).toBe(0);
    expect(remainingStock(0, 2, 0)).toBe(0);
    expect(remainingStock(-1, 2, 0)).toBe(0);
    expect(remainingStock(2, 2, -5)).toBe(2);
  });
});

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("T-244 — loadBookedCounts (règle du tunnel)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let loadBookedCounts: typeof import("@/lib/room-stock").loadBookedCounts;

  let hostId = "";
  let guestId = "";
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const mod = await import("@/lib/room-stock");
    loadBookedCounts = mod.loadBookedCounts;

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (hôte introuvable)");
    hostId = host.id;

    const stamp = Date.now();
    const [guest] = await db
      .insert(schema.users)
      .values({
        email: `t244-stock-${stamp}@test.local`,
        firstName: "Stock",
        lastName: "Test",
        role: "customer",
      })
      .returning();
    guestId = guest.id;

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-244 Property",
        slug: generateSlug(`t244-${stamp}`),
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
        name: "T-244 Room",
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

    // Deux séjours qui se chevauchent + un annulé qui ne doit pas compter.
    const rows = [
      { checkIn: "2034-06-10", checkOut: "2034-06-13", status: "confirmed" }, // nuits 10, 11, 12
      { checkIn: "2034-06-12", checkOut: "2034-06-14", status: "confirmed" }, // nuits 12, 13
      { checkIn: "2034-06-11", checkOut: "2034-06-12", status: "cancelled" }, // ignoré
    ];
    for (const row of rows) {
      const [booking] = await db
        .insert(schema.bookings)
        .values({
          bookingReference: generateBookingReference(),
          userId: guest.id,
          propertyId: prop.id,
          roomId: room.id,
          status: row.status,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          numNights: 2,
          numAdults: 2,
          numChildren: 0,
          guestFirstName: "Stock",
          guestLastName: "Test",
          guestEmail: guest.email,
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
      bookingIds.push(booking.id);
    }
  });

  afterAll(async () => {
    if (bookingIds.length) await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (guestId) await db.delete(schema.users).where(eq(schema.users.id, guestId));
  });

  it("compte un séjour par nuit, départ exclu, annulé ignoré", async () => {
    const counts = await loadBookedCounts(roomId, "2034-06-09", "2034-06-15");
    expect(counts["2034-06-09"]).toBe(0); // avant l'arrivée
    expect(counts["2034-06-10"]).toBe(1); // arrivée incluse
    expect(counts["2034-06-11"]).toBe(1); // l'annulé ne compte pas
    expect(counts["2034-06-12"]).toBe(2); // chevauchement
    expect(counts["2034-06-13"]).toBe(1); // départ du 1er exclu, 2e présent
    expect(counts["2034-06-14"]).toBe(0); // départ du 2e exclu
    expect(counts["2034-06-15"]).toBe(0);
  });

  it("reste cohérent si la plage est plus courte que les séjours", async () => {
    const counts = await loadBookedCounts(roomId, "2034-06-12", "2034-06-12");
    expect(counts["2034-06-12"]).toBe(2);
    expect(Object.keys(counts)).toHaveLength(1);
  });
});
