import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Test d'intégration — T-195 (G3) : GET/POST /api/cron/payouts.
 *
 * Vérifie que la tâche idempotente génère un payout `pending` par (hôte, devise)
 * pour le mois précédent, puis qu'une seconde exécution ne crée aucun doublon.
 * Le runner local ET le cron Vercel déclenchent la route en **GET** (P1) : on
 * vérifie donc que GET et POST produisent le même résultat idempotent.
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

dbTest("T-195 — GET/POST /api/cron/payouts (ledger job idempotent)", () => {
  let POST: typeof import("./route").POST;
  let GET: typeof import("./route").GET;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let hostId = "";
  let seededBookingId = "";
  let prevMonthStart = "";
  let prevMonthEnd = "";

  beforeAll(async () => {
    const route = await import("./route");
    POST = route.POST;
    GET = route.GET;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const [host] = await db.select({ id: schema.users.id, country: schema.users.country }).from(schema.users).where(eq(schema.users.email, "host@mybestbooking.com")).limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;
    const [prop] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.hostId, hostId)).limit(1);
    const [room] = prop ? await db.select({ id: schema.rooms.id }).from(schema.rooms).where(eq(schema.rooms.propertyId, prop.id)).limit(1) : [];
    const [customer] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "customer@mybestbooking.com")).limit(1);
    if (!prop || !room || !customer) throw new Error("Seed incomplet (propriété/chambre/utilisateur)");

    // Période distincte (2025-04) pour ne pas fusionner la clé d'idempotence
    // avec les autres tests qui ciblent le mois courant précédent.
    prevMonthStart = "2025-04-01";
    prevMonthEnd = "2025-04-30";

    const [seeded] = await db.insert(schema.bookings).values({
      bookingReference: `PAYCRON${Date.now().toString().slice(-6)}`,
      userId: customer.id,
      propertyId: prop.id,
      roomId: room.id,
      status: "confirmed",
      checkIn: prevMonthStart,
      checkOut: prevMonthEnd,
      numNights: 1,
      numAdults: 1,
      numChildren: 0,
      guestFirstName: "Cron",
      guestLastName: "Payout",
      guestEmail: "payout-cron@test.dev",
      guestCountry: host.country ?? "FR",
      subtotal: "100.00",
      taxes: "0",
      fees: "0",
      discount: "0",
      total: "100.00",
      currency: "EUR",
      paymentStatus: "paid",
      paymentMethod: "mock_card",
      commissionRate: "15.00",
      commissionAmount: "15.00",
      netToHost: "85.00",
      createdAt: new Date(2025, 3, 15), // 2025-04-15
    }).returning();
    seededBookingId = seeded.id;
  });

  afterAll(async () => {
    const payouts = await db.select({ id: schema.payouts.id }).from(schema.payouts).where(eq(schema.payouts.hostId, hostId));
    if (payouts.length) await db.delete(schema.payouts).where(inArray(schema.payouts.id, payouts.map((p) => p.id)));
    if (seededBookingId) await db.delete(schema.bookings).where(eq(schema.bookings.id, seededBookingId));
    const audit = await db.select({ id: schema.auditLog.id }).from(schema.auditLog).where(eq(schema.auditLog.action, "payout.cron"));
    if (audit.length) await db.delete(schema.auditLog).where(inArray(schema.auditLog.id, audit.map((a) => a.id)));
  });

  it("génère un payout pending pour la période, puis idempotent", async () => {
    const { NextRequest } = await import("next/server");
    const url = `http://localhost/api/cron/payouts?periodStart=${prevMonthStart}&periodEnd=${prevMonthEnd}`;
    const res1 = await POST(new NextRequest(url, { method: "POST" }));
    const body1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(body1.hosts).toBeGreaterThanOrEqual(1);
    expect(body1.created).toBeGreaterThanOrEqual(1);

    const persisted = await db.select().from(schema.payouts).where(and(eq(schema.payouts.hostId, hostId), eq(schema.payouts.periodStart, prevMonthStart)));
    expect(persisted.length).toBeGreaterThanOrEqual(1);
    expect(persisted[0].status).toBe("pending");
    expect(Number(persisted[0].netAmount)).toBeCloseTo(85, 2);

    // Seconde exécution → aucune nouvelle création (idempotence).
    const res2 = await POST(new NextRequest(url, { method: "POST" }));
    const body2 = await res2.json();
    expect(body2.created).toBe(0);
    const countAfter = (await db.select().from(schema.payouts).where(and(eq(schema.payouts.hostId, hostId), eq(schema.payouts.periodStart, prevMonthStart)))).length;
    expect(countAfter).toBe(persisted.length);
  });

  it("GET (cron Vercel / runner local) → même comportement idempotent (P1)", async () => {
    const { NextRequest } = await import("next/server");
    const url = `http://localhost/api/cron/payouts?periodStart=${prevMonthStart}&periodEnd=${prevMonthEnd}`;
    // GET sur une période déjà générée : aucune nouvelle création, 200.
    const res = await GET(new NextRequest(url, { method: "GET" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.created).toBe(0);
    const count = (await db.select().from(schema.payouts).where(and(eq(schema.payouts.hostId, hostId), eq(schema.payouts.periodStart, prevMonthStart)))).length;
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
