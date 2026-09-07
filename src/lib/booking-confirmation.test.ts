import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * T-203 — E-mail de confirmation (P7).
 *
 * `sendBookingConfirmationIfNeeded` doit être déclenchée dès qu'une réservation
 * est `confirmed`, même si le paiement est constaté sur place (`pending` à la
 * confirmation en mode manuel). Elle émet 2 events outbox (voyageur + hôte),
 * est idempotente (`confirmationEmailSentAt`) et respecte l'interrupteur
 * `notifications.bookingConfirmation`.
 *
 * Test d'intégration (DB de test réelle) : property/room/booking créés puis
 * nettoyés.
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

dbTest("T-203 — sendBookingConfirmationIfNeeded (confirmation manuelle)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let sendBookingConfirmationIfNeeded: typeof import("@/lib/booking-confirmation").sendBookingConfirmationIfNeeded;
  let hostId = "";
  let customerId = "";
  let customerEmail = "";
  let propId = "";
  let roomId = "";
  let bookingId = "";

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const mod = await import("@/lib/booking-confirmation");
    sendBookingConfirmationIfNeeded = mod.sendBookingConfirmationIfNeeded;

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
        email: `t203-confirm-${Date.now()}@test.local`,
        firstName: "Conf",
        lastName: "Mail",
        role: "customer",
        language: "fr",
      })
      .returning();
    customerId = customer.id;
    customerEmail = customer.email;

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-203 Confirm Property",
        slug: generateSlug(`t203-confirm-${Date.now()}`),
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
        name: "T-203 Confirm Room",
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

    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customer.id,
        propertyId: prop.id,
        roomId: room.id,
        // T-203 : la confirmation part sur `status:"confirmed"` même si le
        // paiement est encore `pending` (paiement sur place / manuel).
        status: "confirmed",
        checkIn: "2033-05-01",
        checkOut: "2033-05-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Conf",
        guestLastName: "Mail",
        guestEmail: customer.email,
        paymentStatus: "pending",
        paymentIntentId: null,
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
    bookingId = booking.id;
  });

  afterAll(async () => {
    if (bookingId) {
      await db
        .delete(schema.emailOutbox)
        .where(eq(schema.emailOutbox.eventKey, `booking-confirmation:${bookingId}:guest`));
      await db
        .delete(schema.emailOutbox)
        .where(eq(schema.emailOutbox.eventKey, `booking-confirmation:${bookingId}:host`));
      await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    }
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (customerId) await db.delete(schema.users).where(eq(schema.users.id, customerId));
  });

  it("confirmed sans paiement (manuel) → 2 events outbox (voyageur + hôte) + confirmationEmailSentAt", async () => {
    const result = await sendBookingConfirmationIfNeeded(bookingId);
    expect(result).toBe(true);

    const rows = await db
      .select({ eventKey: schema.emailOutbox.eventKey, to: schema.emailOutbox.to, status: schema.emailOutbox.status })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `booking-confirmation:${bookingId}:guest`));
    expect(rows.length).toBe(1);
    expect(rows[0].to).toBe(customerEmail);

    const hostRows = await db
      .select({ eventKey: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `booking-confirmation:${bookingId}:host`));
    expect(hostRows.length).toBe(1);

    const [b] = await db.select({ sent: schema.bookings.confirmationEmailSentAt }).from(schema.bookings).where(eq(schema.bookings.id, bookingId));
    expect(b.sent).not.toBeNull();
  });

  it("idempotent : re-appeler ne recrée pas les events", async () => {
    const again = await sendBookingConfirmationIfNeeded(bookingId);
    expect(again).toBe(false);
    const guestRows = await db
      .select({ eventKey: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `booking-confirmation:${bookingId}:guest`));
    expect(guestRows.length).toBe(1);
  });

  it("non confirmé → aucun event (garde status)", async () => {
    const { generateBookingReference } = await import("@/lib/utils");
    const [bOther] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId: roomId,
        status: "pending",
        checkIn: "2033-06-01",
        checkOut: "2033-06-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Conf",
        guestLastName: "Mail",
        guestEmail: customerEmail,
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
    const otherId = bOther.id;
    try {
      const result = await sendBookingConfirmationIfNeeded(otherId);
      expect(result).toBe(false);
      const guestRows = await db
        .select({ eventKey: schema.emailOutbox.eventKey })
        .from(schema.emailOutbox)
        .where(eq(schema.emailOutbox.eventKey, `booking-confirmation:${otherId}:guest`));
      expect(guestRows.length).toBe(0);
    } finally {
      await db.delete(schema.bookings).where(eq(schema.bookings.id, otherId));
    }
  });
});
