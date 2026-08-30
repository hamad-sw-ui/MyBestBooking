import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * Test d'intégration — T-150 : notification d'annulation à l'hôte.
 *
 * Garantit que `notifyBookingCancellation` émet bien DEUX e-mails dans
 * l'outbox (voyageur + hôte), chacun vers le bon destinataire, la langue
 * de chacun étant celle du destinataire (hôte `language=en` → e-mail
 * anglais). Skip automatique si la DB n'est pas accessible. Ne modifie
 * que les lignes créées puis nettoyées ici.
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

dbTest("T-150 — e-mail d'annulation envoyé au voyageur ET à l'hôte", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let hostId = "";
  let guestId = "";
  let propId = "";
  let roomId = "";
  let bookingId = "";
  const outboxKeys: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const { generateSlug } = await import("@/lib/utils");

    const [host] = await db
      .insert(schema.users)
      .values({
        email: `host-t150-${Date.now()}@test.local`,
        firstName: "Paul",
        lastName: "Host",
        role: "host",
        language: "en",
      })
      .returning();
    hostId = host.id;

    const [guest] = await db
      .insert(schema.users)
      .values({
        email: `guest-t150-${Date.now()}@test.local`,
        firstName: "Marie",
        lastName: "Guest",
        language: "fr",
      })
      .returning();
    guestId = guest.id;

    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-150 Cancel Property",
        slug: generateSlug(`t150-cancel-${Date.now()}`),
        type: "hotel",
        city: "Yaoundé",
        country: "CM",
        status: "active",
      })
      .returning();
    propId = prop.id;

    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-150 Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        quantity: 1,
        isActive: true,
      })
      .returning({ id: schema.rooms.id });
    roomId = room.id;

    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: `MBB-T150-${Date.now().toString(36).toUpperCase()}`,
        userId: guestId,
        propertyId: prop.id,
        roomId: room.id,
        status: "confirmed",
        checkIn: "2026-10-01",
        checkOut: "2026-10-04",
        numNights: 3,
        numAdults: 1,
        guestFirstName: "Marie",
        guestLastName: "Guest",
        guestEmail: guest.email,
        subtotal: "300.00",
        total: "330.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "49.50",
        netToHost: "250.50",
        cancellationReason: "Annulation demandée",
        cancellationFee: "0.00",
        refundAmount: "330.00",
        refundStatus: "none",
      })
      .returning();
    bookingId = booking.id;

    // Réinitialise le cache settings (getSetting est consulté par les templates).
    const { clearSettingsCache } = await import("@/lib/settings");
    clearSettingsCache();
  });

  afterAll(async () => {
    const { inArray, eq } = await import("drizzle-orm");
    if (outboxKeys.length) {
      await db.delete(schema.emailOutbox).where(inArray(schema.emailOutbox.eventKey, outboxKeys));
    }
    if (bookingId) {
      await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    }
    if (roomId) {
      await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    }
    if (propId) {
      await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    }
    if (hostId) {
      await db.delete(schema.users).where(eq(schema.users.id, hostId));
    }
    if (guestId) {
      await db.delete(schema.users).where(eq(schema.users.id, guestId));
    }
  });

  it("notifie le voyageur (fr) et l'hôte (en) avec des eventKeys distincts", async () => {
    const { eq, inArray } = await import("drizzle-orm");
    const { notifyBookingCancellation } = await import("./booking-cancellation");

    const [property] = await db
      .select({ name: schema.properties.name })
      .from(schema.properties)
      .where(eq(schema.properties.id, propId))
      .limit(1);

    await notifyBookingCancellation({
      booking: {
        ...(await db
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, bookingId))
          .limit(1))[0],
      },
      propertyName: property?.name ?? "",
      cancellationFee: 0,
    });

    const guestKey = `booking-cancellation:${bookingId}`;
    const hostKey = `booking-cancellation:${bookingId}:host`;
    outboxKeys.push(guestKey, hostKey);

    const [guestRow] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, guestKey))
      .limit(1);
    const [hostRow] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, hostKey))
      .limit(1);

    // Voyageur : destinataire = guestEmail, habillage français.
    expect(guestRow).toBeDefined();
    const [guestUser] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, guestId))
      .limit(1);
    expect(guestRow.to).toBe(guestUser?.email);
    expect(guestRow.subject).toContain("Réservation annulée");
    expect(guestRow.html).toContain("Réservez mieux");

    // Hôte : destinataire = email de l'hôte, e-mail en ANGLAIS (hôte en).
    expect(hostRow).toBeDefined();
    const [hostUser] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, hostId))
      .limit(1);
    expect(hostRow.to).toBe(hostUser?.email);
    expect(hostRow.subject).toContain("Cancellation of your booking");
    expect(hostRow.subject).toMatch(/MBB-T150-[A-Z0-9]+/);
    expect(hostRow.html).toContain("has been cancelled");
    expect(hostRow.html).toContain("View my bookings");
    expect(hostRow.html).toContain("/dashboard/bookings");
    expect(hostRow.html).toContain("Book better. Travel further.");
    expect(hostRow.html).not.toContain("Réservez mieux");

    // Les deux e-mails transitent par l'outbox (jamais d'envoi direct).
    const sent = await db
      .select({ eventKey: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(inArray(schema.emailOutbox.eventKey, [guestKey, hostKey]));
    expect(sent.length).toBe(2);
  });
});
