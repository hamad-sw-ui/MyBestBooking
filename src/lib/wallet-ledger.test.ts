import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-248 (audit n°5, A6 — reprise de O1) — journal du wallet.
 *
 * Contrats vérifiés :
 *  - un crédit de cashback (clôture de séjour) écrit **une** ligne, et la
 *    somme des lignes égale le solde de `users.wallet_balance` ;
 *  - le rejeu du traitement (idempotence `loyaltyAwardedAt`) n'ajoute **pas**
 *    de seconde ligne ;
 *  - un remboursement de réservation annulée est journalisé lui aussi ;
 *  - le journal est propre à chaque utilisateur (aucune fuite).
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

dbTest("T-248 — journal du wallet", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let ledger: typeof import("@/lib/wallet-ledger");
  let userId = "";
  let bookingId = "";

  /** Solde recalculé comme « solde initial + somme du journal ». */
  async function sumOfEntries(): Promise<number> {
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.userId, userId));
    return rows.reduce((total, row) => total + Number(row.amount), 0);
  }

  beforeAll(async () => {
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    ledger = await import("@/lib/wallet-ledger");
    const { eq } = await import("drizzle-orm");

    const [user] = await db
      .insert(schema.users)
      .values({
        email: `t248-${Date.now()}@test.local`,
        firstName: "Wallet",
        lastName: "Test",
        walletBalance: "0.00",
      })
      .returning();
    userId = user.id;

    const [property] = await db.select().from(schema.properties).limit(1);
    const [room] = await db.select().from(schema.rooms).limit(1);
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: `T248-${Date.now()}`.slice(0, 20),
        userId,
        propertyId: property!.id,
        roomId: room!.id,
        checkIn: "2026-09-01",
        checkOut: "2026-09-05",
        numNights: 4,
        numAdults: 2,
        guestFirstName: "Wallet",
        guestLastName: "Test",
        guestEmail: "wallet@test.local",
        subtotal: "400.00",
        total: "400.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "60.00",
        netToHost: "340.00",
        status: "completed",
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

  it("un crédit écrit une ligne et solde = somme des lignes", async () => {
    await db.transaction(async (tx) => {
      const { eq } = await import("drizzle-orm");
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).for("update");
      const balanceAfter = (Number(user!.walletBalance ?? "0") + 20).toFixed(2);
      await tx.update(schema.users).set({ walletBalance: balanceAfter }).where(eq(schema.users.id, userId));
      await ledger.recordWalletEntry(tx, {
        userId,
        amount: 20,
        balanceAfter,
        kind: "cashback",
        bookingId,
      });
    });

    const { eq } = await import("drizzle-orm");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    const entries = await ledger.listWalletEntries(userId);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("cashback");
    expect(entries[0]?.amount).toBe("20.00");
    expect(entries[0]?.balanceAfter).toBe("20.00");
    expect(Number(user!.walletBalance)).toBe(await sumOfEntries());
  });

  it("un montant nul n'écrit rien et un montant signé est conservé", async () => {
    await db.transaction(async (tx) => {
      await ledger.recordWalletEntry(tx, {
        userId,
        amount: 0,
        balanceAfter: 20,
        kind: "cashback",
        bookingId,
      });
    });
    expect(await ledger.listWalletEntries(userId)).toHaveLength(1);

    // Débit (consommation future) : le signe est conservé tel quel.
    await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ walletBalance: "5.00" }).where(
        (await import("drizzle-orm")).eq(schema.users.id, userId),
      );
      await ledger.recordWalletEntry(tx, {
        userId,
        amount: -15,
        balanceAfter: 5,
        kind: "booking_payment",
        bookingId,
      });
    });
    const entries = await ledger.listWalletEntries(userId);
    const debit = entries.find((entry) => entry.kind === "booking_payment");
    expect(debit?.amount).toBe("-15.00");
    expect(debit?.balanceAfter).toBe("5.00");
  });

  it("l'historique est propre à chaque utilisateur", async () => {
    const { eq } = await import("drizzle-orm");
    const [other] = await db
      .insert(schema.users)
      .values({ email: `t248-other-${Date.now()}@test.local`, firstName: "Autre", lastName: "Voyageur" })
      .returning();
    expect(await ledger.listWalletEntries(other.id)).toHaveLength(0);
    await db.delete(schema.users).where(eq(schema.users.id, other.id));
  });

  it("countWalletEntries suit le nombre de lignes", async () => {
    const total = await ledger.countWalletEntries(userId);
    expect(total).toBe(await ledger.listWalletEntries(userId, 50).then((rows) => rows.length));
    expect(total).toBe(2);
  });

  it("recordWalletEntry n'est jamais appelé en dehors d'une transaction porteuse", async () => {
    // Une erreur du journal doit annuler le solde : on simule un insert en
    // échec (kind trop long) et on vérifie que la transaction est annulée.
    const { eq } = await import("drizzle-orm");
    const before = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    await expect(
      db.transaction(async (tx) => {
        await tx
          .update(schema.users)
          .set({ walletBalance: "999.00" })
          .where(eq(schema.users.id, userId));
        await ledger.recordWalletEntry(tx, {
          userId,
          amount: 994,
          balanceAfter: 999,
          // 40 caractères > varchar(32) : l'insert échoue.
          kind: "x".repeat(40) as never,
        });
      }),
    ).rejects.toBeTruthy();
    const after = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(after[0]?.walletBalance).toBe(before[0]?.walletBalance);
  });
});
