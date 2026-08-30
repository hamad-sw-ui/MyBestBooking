import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * T-156 (audit n°29) — annulation par acteur : hôte/admin = remboursement
 * intégral (fee 0, motif forcé par le serveur) ; voyageur = grille de
 * politique (inchangé). Intégration sur DB réelle (skip si indisponible).
 * Ne modifie que les lignes créées ici (nettoyage en afterAll).
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

dbTest("T-156 — annulation par acteur (host/admin/customer)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let cancelBooking: typeof import("@/lib/booking-cancellation").cancelBooking;
  let notifyBookingCancellation: typeof import("@/lib/booking-cancellation").notifyBookingCancellation;
  let generateBookingReference: () => string;
  let hostId = "";
  let adminId = "";
  let customerId = "";
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];

  async function makeBooking(checkIn: string, checkOut?: string): Promise<string> {
    const [b] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId,
        status: "confirmed",
        checkIn,
        checkOut: checkOut ?? "2099-01-05",
        numNights: 4,
        numAdults: 2,
        guestFirstName: "Test",
        guestLastName: "Actor",
        guestEmail: "guest-actor@test.local",
        subtotal: "500.00",
        taxes: "0",
        discount: "0",
        total: "500.00",
        currency: "EUR",
        paymentStatus: "unpaid", // pas de PSP : tests hors réseau
        commissionRate: "15.00",
        commissionAmount: "75.00",
        netToHost: "425.00",
        // Politique non remboursable → voyageur = 500 € / opérateur = 0 €.
        ratePlanSnapshot: { cancellationPolicy: "non_refundable", cancellationFreeDays: 0 },
      })
      .returning();
    bookingIds.push(b.id);
    return b.id;
  }

  beforeAll(async () => {
    const { cancelBooking: cb, notifyBookingCancellation: nb } = await import("@/lib/booking-cancellation");
    cancelBooking = cb;
    notifyBookingCancellation = nb;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const { generateSlug, generateBookingReference: genRef } = await import("@/lib/utils");
    generateBookingReference = genRef;
    const { eq } = await import("drizzle-orm");

    const seed = async (email: string, role: "customer" | "host" | "admin") => {
      const [u] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      if (!u) throw new Error("Seed non appliqué");
      return u.id;
    };
    customerId = await seed("customer@mybestbooking.com", "customer");
    hostId = await seed("host@mybestbooking.com", "host");
    adminId = await seed("admin@mybestbooking.com", "admin");

    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-156 Actor Test Property",
        slug: generateSlug(`t156-actor-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
        cancellationPolicy: "non_refundable",
      })
      .returning();
    propId = prop.id;
    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-156 Actor Test Room",
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
    const { eq: eqOp, inArray } = await import("drizzle-orm");
    if (bookingIds.length) {
      await db.delete(schema.emailOutbox).where(
        inArray(
          schema.emailOutbox.eventKey,
          bookingIds.flatMap((id) => [`booking-cancellation:${id}`, `booking-cancellation:${id}:host`]),
        ),
      );
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    }
    if (roomId) await db.delete(schema.rooms).where(eqOp(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eqOp(schema.properties.id, propId));
  });

  it("host → fee 0, remboursement intégral, motif forcé « par l'hébergeur »", async () => {
    const id = await makeBooking("2099-01-01", "2099-01-05");
    const out = await cancelBooking(id, "Annulation demandée par le voyageur", "host");
    expect(out.cancellationFee).toBe(0);
    expect(out.booking.status).toBe("cancelled");
    expect(out.booking.cancellationReason).toBe("Annulée par l'hébergeur");
    expect(Number(out.booking.refundAmount)).toBe(500);
    expect(out.booking.cancellationFee).toBe("0.00");
  });

  it("admin → fee 0, motif forcé « par l'administrateur »", async () => {
    const id = await makeBooking("2099-02-01", "2099-02-05");
    const out = await cancelBooking(id, "raison quelconque", "admin");
    expect(out.cancellationFee).toBe(0);
    expect(out.booking.cancellationReason).toBe("Annulée par l'administrateur");
    expect(Number(out.booking.refundAmount)).toBe(500);
  });

  it("customer → grille appliquée (non_refundable = 500 €) et motif conservé", async () => {
    const id = await makeBooking("2099-03-01", "2099-03-05");
    const out = await cancelBooking(id, "Raison du voyageur", "customer");
    expect(out.cancellationFee).toBe(500);
    expect(out.booking.cancellationReason).toBe("Raison du voyageur");
    expect(Number(out.booking.refundAmount)).toBe(0);
  });

  it("notify(actor=host) → mail plateforme envoyé au voyageur (clé outbox déterministe)", async () => {
    const id = await makeBooking("2099-04-01", "2099-04-05");
    const out = await cancelBooking(id, "", "host");
    await notifyBookingCancellation(out, "host");
    const [mail] = await db
      .select({ key: schema.emailOutbox.eventKey, to: schema.emailOutbox.to })
      .from(schema.emailOutbox)
      .where(
        (await import("drizzle-orm")).eq(schema.emailOutbox.eventKey, `booking-cancellation:${id}`),
      );
    expect(mail).toBeDefined();
    expect(mail!.to).toBe("guest-actor@test.local");
  });
});
