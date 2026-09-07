import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Test d'intégration — T-195 (G6) : `createPayoutsForPeriod` multi-devise.
 *
 * Une période avec des bookings payés en EUR **et** XAF doit produire UN payout
 * par devise (jamais une somme inter-devises) ; le journal est idempotent.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db" });
  const c = await pool.connect();
  await c.query("SELECT 1");
  c.release();
  await pool.end();
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("T-195 — createPayoutsForPeriod multi-devise (G6)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let createPayoutsForPeriod: typeof import("./payout-service").createPayoutsForPeriod;
  let hostId = "";
  let seededBookingIds: string[] = [];
  let periodStart = "";
  let periodEnd = "";

  beforeAll(async () => {
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    createPayoutsForPeriod = (await import("./payout-service")).createPayoutsForPeriod;
    const [host] = await db.select({ id: schema.users.id, country: schema.users.country }).from(schema.users).where(eq(schema.users.email, "host@mybestbooking.com")).limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;
    const [prop] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.hostId, hostId)).limit(1);
    const [room] = prop ? await db.select({ id: schema.rooms.id }).from(schema.rooms).where(eq(schema.rooms.propertyId, prop.id)).limit(1) : [];
    const [customer] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "customer@mybestbooking.com")).limit(1);
    if (!prop || !room || !customer) throw new Error("Seed incomplet");

    // Période distincte (2025-03) pour éviter toute fusion de clé d'idempotence
    // avec le cron test (2025-04) ou la route (mois courant précédent).
    periodStart = "2025-03-01";
    periodEnd = "2025-03-31";
    const createdAt = new Date(2025, 2, 15); // 2025-03-15

    for (const [i, cur] of ["EUR", "XAF"].entries()) {
      const total = cur === "EUR" ? "100.00" : "100000.00";
      const commission = cur === "EUR" ? "15.00" : "15000.00";
      const net = cur === "EUR" ? "85.00" : "85000.00";
      const [b] = await db.insert(schema.bookings).values({
        bookingReference: `PAYMULTI${Date.now().toString().slice(-5)}${i}`,
        userId: customer.id,
        propertyId: prop.id,
        roomId: room.id,
        status: "confirmed",
        checkIn: periodStart,
        checkOut: periodEnd,
        numNights: 1,
        numAdults: 1,
        numChildren: 0,
        guestFirstName: "Multi",
        guestLastName: "Currency",
        guestEmail: "payout-multi@test.dev",
        guestCountry: host.country ?? "FR",
        subtotal: total,
        taxes: "0",
        fees: "0",
        discount: "0",
        total,
        currency: cur,
        paymentStatus: "paid",
        paymentMethod: "mock_card",
        commissionRate: "15.00",
        commissionAmount: commission,
        netToHost: net,
        createdAt,
      }).returning();
      seededBookingIds.push(b.id);
    }
  });

  afterAll(async () => {
    if (seededBookingIds.length) await db.delete(schema.bookings).where(inArray(schema.bookings.id, seededBookingIds));
    // Ne supprime que les payouts de LA période de ce test (2025-03).
    const payouts = await db.select({ id: schema.payouts.id }).from(schema.payouts).where(and(eq(schema.payouts.hostId, hostId), eq(schema.payouts.periodStart, periodStart)));
    if (payouts.length) await db.delete(schema.payouts).where(inArray(schema.payouts.id, payouts.map((p) => p.id)));
  });

  it("produit UN payout par devise (pas de somme inter-devises)", async () => {
    const res = await createPayoutsForPeriod(hostId, false, periodStart, periodEnd);
    expect(res.created).toBe(true);
    expect(res.payouts.length).toBe(2);
    const currencies = res.payouts.map((p) => p.currency).sort();
    expect(currencies).toEqual(["EUR", "XAF"]);
    const eur = res.payouts.find((p) => p.currency === "EUR")!;
    expect(Number(eur.netAmount)).toBeCloseTo(85, 2);
    const xaf = res.payouts.find((p) => p.currency === "XAF")!;
    expect(Number(xaf.netAmount)).toBeCloseTo(85000, 2);
  });

  it("est idempotent (même clé → réutilisé, pas de doublon)", async () => {
    const res = await createPayoutsForPeriod(hostId, false, periodStart, periodEnd);
    expect(res.created).toBe(false);
    expect(res.payouts.length).toBe(2);
  });
});
