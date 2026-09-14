import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Vérifie l'e-mail émis quand le dashboard clôture un séjour.
 * Les fixtures et l'outbox sont supprimés après le test.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
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

dbTest("booking completed notification", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let bookingId = "";
  let customerId = "";
  let propertyId = "";
  let roomId = "";

  beforeAll(async () => {
    const dbModule = await import("@/db");
    db = dbModule.db;
    schema = await import("@/db/schema");
    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [host] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed host absent");

    const [customer] = await db
      .insert(schema.users)
      .values({
        email: `completed-mail-${Date.now()}@test.local`,
        firstName: "Completed",
        lastName: "Guest",
        role: "customer",
        language: "en",
      })
      .returning({ id: schema.users.id, email: schema.users.email });
    customerId = customer.id;

    const [property] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "Completed Mail Property",
        slug: generateSlug(`completed-mail-${Date.now()}`),
        type: "hotel",
        city: "Yaoundé",
        country: "CM",
        status: "active",
      })
      .returning({ id: schema.properties.id });
    propertyId = property.id;

    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId,
        name: "Completed Mail Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        currency: "EUR",
        quantity: 1,
        isActive: true,
      })
      .returning({ id: schema.rooms.id });
    roomId = room.id;

    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customer.id,
        propertyId,
        roomId,
        status: "completed",
        checkIn: "2026-07-01",
        checkOut: "2026-07-04",
        numNights: 3,
        numAdults: 1,
        numChildren: 0,
        guestFirstName: "Completed",
        guestLastName: "Guest",
        guestEmail: customer.email,
        paymentStatus: "paid",
        subtotal: "300.00",
        taxes: "0",
        discount: "0",
        total: "300.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "45.00",
        netToHost: "255.00",
      })
      .returning({ id: schema.bookings.id });
    bookingId = booking.id;
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (bookingId) {
      await db.delete(schema.emailOutbox).where(eq(schema.emailOutbox.eventKey, `booking-completed:${bookingId}`));
      await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    }
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propertyId) await db.delete(schema.properties).where(eq(schema.properties.id, propertyId));
    if (customerId) await db.delete(schema.users).where(inArray(schema.users.id, [customerId]));
  });

  it("envoie un e-mail localisé au voyageur et reste idempotent", async () => {
    const { sendBookingCompletedNotificationIfNeeded } = await import("./booking-completed-notification");

    await expect(sendBookingCompletedNotificationIfNeeded(bookingId)).resolves.toBe(true);
    const [mail] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `booking-completed:${bookingId}`));
    expect(mail).toBeDefined();
    expect(mail?.status).toBe("sent");
    expect(mail?.subject).toContain("Stay completed");
    expect(mail?.html).toContain("View my booking");

    await expect(sendBookingCompletedNotificationIfNeeded(bookingId)).resolves.toBe(false);
    const rows = await db
      .select({ id: schema.emailOutbox.id })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `booking-completed:${bookingId}`));
    expect(rows).toHaveLength(1);
  });
});
