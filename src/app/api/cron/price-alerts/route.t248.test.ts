import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * T-248 (audit n°5, A6) — bout en bout : la clôture d'un séjour (cron) crédite
 * le cashback BestRewards **et** journalise le mouvement.
 *
 * Contrats vérifiés :
 *  - une ligne `cashback` par séjour terminé, et la somme des lignes égale le
 *    solde de `users.wallet_balance` ;
 *  - le rejeu du cron (idempotence `loyaltyAwardedAt`) n'ajoute aucune ligne et
 *    ne modifie pas le solde ;
 *  - la réponse du cron conserve ses compteurs pour ce séjour.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const connection = await pool.connect();
  await connection.query("SELECT 1");
  connection.release();
  await pool.end();
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("T-248 — cashback journalisé par le cron", () => {
  let GET: (req: unknown) => Promise<Response>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let userId = "";
  let bookingId = "";
  let propertyId = "";
  let roomId = "";
  let hostId = "";

  async function runCron() {
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://localhost/api/cron/price-alerts"));
    expect(res.status).toBe(200);
    return (await res.json()) as Record<string, unknown>;
  }

  beforeAll(async () => {
    GET = (await import("./route")).GET as unknown as typeof GET;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    // Utilisateur « Ambassador » (niveau 3) pour un cashback non nul, avec un
    // séjour passé confirmé et payé mais jamais clôturé.
    const [host] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    hostId = host!.id;

    const [user] = await db
      .insert(schema.users)
      .values({
        email: `t248-cron-${Date.now()}@test.local`,
        firstName: "Cashback",
        lastName: "Cron",
        role: "customer",
        walletBalance: "0.00",
        bestrewardsLevel: 3,
        bestrewardsBookingsCount: 20,
      })
      .returning();
    userId = user.id;

    const [property] = await db.select().from(schema.properties).limit(1);
    propertyId = property!.id;
    const [room] = await db
      .select({ id: schema.rooms.id })
      .from(schema.rooms)
      .where(eq(schema.rooms.propertyId, propertyId))
      .limit(1);
    roomId = room!.id;

    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: `T248C-${Date.now()}`.slice(0, 20),
        userId,
        propertyId,
        roomId,
        checkIn: "2026-08-01",
        checkOut: "2026-08-05",
        numNights: 4,
        numAdults: 2,
        guestFirstName: "Cashback",
        guestLastName: "Cron",
        guestEmail: "cashback@test.local",
        subtotal: "100.00",
        total: "100.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "15.00",
        netToHost: "85.00",
        status: "confirmed",
        paymentStatus: "paid",
      })
      .returning();
    bookingId = booking.id;
  });

  afterAll(async () => {
    if (!db) return;
    const { eq } = await import("drizzle-orm");
    await db.delete(schema.walletTransactions).where(eq(schema.walletTransactions.userId, userId));
    await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("clôture le séjour, crédite le cashback (5 %) et écrit une ligne", async () => {
    const payload = await runCron();
    expect(payload.completedBookings as number).toBeGreaterThanOrEqual(1);

    const { eq } = await import("drizzle-orm");
    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
    expect(booking!.status).toBe("completed");
    expect(booking!.loyaltyAwardedAt).toBeTruthy();
    // Niveau 3 → 5 % de 100 EUR.
    expect(Number(booking!.cashbackAmount)).toBe(5);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    const entries = await db
      .select()
      .from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.userId, userId));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("cashback");
    expect(Number(entries[0]?.amount)).toBe(5);
    expect(Number(entries[0]?.balanceAfter)).toBe(Number(user!.walletBalance));
    expect(entries[0]?.bookingId).toBe(bookingId);
  });

  it("le rejeu du cron n'ajoute ni ligne ni solde (idempotence)", async () => {
    const { eq } = await import("drizzle-orm");
    const [before] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    await runCron();
    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    const entries = await db
      .select()
      .from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.userId, userId));

    expect(Number(after!.walletBalance)).toBe(Number(before!.walletBalance));
    expect(entries).toHaveLength(1);
  });

  it("le cron reste supervisé : une trace d'exécution est écrite", async () => {
    const { desc } = await import("drizzle-orm");
    const [last] = await db
      .select()
      .from(schema.cronRuns)
      .orderBy(desc(schema.cronRuns.startedAt))
      .limit(1);
    expect(last?.name).toBe("price-alerts");
    expect(last?.ok).toBe(true);
    expect(last?.counters).toBeTruthy();
    expect(hostId).toBeTruthy();
  });
});
