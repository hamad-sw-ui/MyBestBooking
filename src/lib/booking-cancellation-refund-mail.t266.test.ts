import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";

/**
 * T-266 (audit n°7, C2) — l'e-mail d'annulation du voyageur dit le montant ET
 * la modalité du remboursement :
 *   - paiement **hors plateforme** (`paymentMethodOffline`) : « sera traité
 *     directement par l'hébergeur » (rien ne « s'exécute » en arrière-plan —
 *     l'ancien affichage « en cours » était à vie) ;
 *   - paiement en ligne (réconciliation PSP) : « est en cours » ;
 *   - aucun remboursement dû (demande non payée) : **aucune** ligne.
 *
 * Test d'intégration : DB réelle, fixtures nettoyées (outbox comprise).
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
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

dbTest("T-266 — e-mail d'annulation : ligne de remboursement", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let cancelBooking: typeof import("@/lib/booking-cancellation").cancelBooking;
  let notifyBookingCancellation: typeof import("@/lib/booking-cancellation").notifyBookingCancellation;
  let customerId = "";
  let hostId = "";
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];

  async function makeBooking(input: {
    checkIn: string;
    checkOut: string;
    paymentStatus: string;
    paymentMethodOffline?: boolean;
  }): Promise<string> {
    const [b] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: (await import("@/lib/utils")).generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId,
        status: "confirmed",
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        numNights: 4,
        numAdults: 2,
        guestFirstName: "Refund",
        guestLastName: "T266",
        guestEmail: "refund-t266@test.local",
        subtotal: "500.00",
        taxes: "0",
        discount: "0",
        total: "500.00",
        currency: "EUR",
        paymentStatus: input.paymentStatus,
        paymentMethodOffline: input.paymentMethodOffline ?? false,
        commissionRate: "15.00",
        commissionAmount: "75.00",
        netToHost: "425.00",
        // « moderate » + 4 nuits avec checkIn lointain → frais 0 % :
        // le remboursement intégral est le seul variable testé.
        ratePlanSnapshot: { cancellationPolicy: "moderate", cancellationFreeDays: 0 },
      })
      .returning();
    bookingIds.push(b.id);
    return b.id;
  }

  beforeAll(async () => {
    const mod = await import("@/lib/booking-cancellation");
    cancelBooking = mod.cancelBooking;
    notifyBookingCancellation = mod.notifyBookingCancellation;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");

    const seed = async (email: string) => {
      const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      if (!u) throw new Error("Seed non appliqué");
      return u.id;
    };
    customerId = await seed("customer@mybestbooking.com");
    hostId = await seed("host@mybestbooking.com");

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-266 Refund Mail Property",
        slug: generateSlug(`t266-refund-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
        cancellationPolicy: "moderate",
      })
      .returning();
    propId = prop.id;
    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-266 Refund Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        quantity: 5,
        isActive: true,
        currency: "EUR",
      })
      .returning();
    roomId = room.id;
  });

  afterAll(async () => {
    if (bookingIds.length) {
      await db.delete(schema.emailOutbox).where(
        inArray(
          schema.emailOutbox.eventKey,
          bookingIds.flatMap((id) => [`booking-cancellation:${id}`, `booking-cancellation:${id}:host`]),
        ),
      );
      await db.delete(schema.auditLog).where(inArray(schema.auditLog.entityId, bookingIds));
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    }
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
  });

  async function travelerEmailText(bookingId: string): Promise<string> {
    const [row] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `booking-cancellation:${bookingId}`));
    if (!row) throw new Error("E-mail voyageur absent de l'outbox");
    return row.text;
  }

  it("paiement sur place annulé → montant + « hébergeur », jamais « en cours »", async () => {
    const id = await makeBooking({ checkIn: "2099-01-01", checkOut: "2099-01-05", paymentStatus: "paid", paymentMethodOffline: true });
    const outcome = await cancelBooking(id, "Changement de plan", "customer");
    expect(outcome.booking.refundStatus).toBe("pending");
    expect(Number(outcome.booking.refundAmount)).toBe(500);
    await notifyBookingCancellation(outcome, "customer");
    const text = await travelerEmailText(id);
    expect(text).toContain("500.00 EUR");
    expect(text).toContain("sera traité directement par l'hébergeur");
    expect(text).not.toContain("est en cours");
  });

  it("paiement en ligne (réconciliation PSP) → « est en cours »", async () => {
    const id = await makeBooking({ checkIn: "2099-02-01", checkOut: "2099-02-05", paymentStatus: "paid" });
    const outcome = await cancelBooking(id, "Changement de plan", "customer");
    expect(outcome.booking.refundStatus).toBe("pending");
    await notifyBookingCancellation(outcome, "customer");
    const text = await travelerEmailText(id);
    expect(text).toContain("500.00 EUR");
    expect(text).toContain("est en cours");
    expect(text).not.toContain("hébergeur");
  });

  it("demande non payée → aucune ligne de remboursement (e-mail inchangé)", async () => {
    const id = await makeBooking({ checkIn: "2099-03-01", checkOut: "2099-03-05", paymentStatus: "pending" });
    const outcome = await cancelBooking(id, "Changement de plan", "customer");
    expect(outcome.booking.refundStatus).toBe("none");
    await notifyBookingCancellation(outcome, "customer");
    const text = await travelerEmailText(id);
    expect(text).not.toContain("remboursement de");
    expect(text).not.toContain("Remboursement de");
  });
});
