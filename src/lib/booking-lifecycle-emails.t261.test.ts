import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";

/**
 * T-261 (audit n°6, B9) — les rappels de séjour et les demandes d'avis
 * respectent la préférence **du voyageur**, pas seulement l'interrupteur global.
 *
 * Preuve demandée : un compte qui a coupé « rappels de séjour » ou « demandes
 * d'avis » ne reçoit rien, alors qu'un compte sans réglage (`null` = héritage)
 * reçoit exactement ce qu'il recevait avant — l'outbox (`eventKey` déterministe)
 * prouve l'envoi sans dépendre du transport e-mail.
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

function iso(daysFromToday: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

dbTest("T-261 — rappels et demandes d'avis : la préférence du voyageur est respectée", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let sendBookingReminders: typeof import("./booking-lifecycle-emails").sendBookingReminders;
  let sendReviewRequests: typeof import("./booking-lifecycle-emails").sendReviewRequests;

  let propertyId = "";
  let roomId = "";
  let commissionRate = "15.00";
  const userIds: string[] = [];
  const bookingIds: string[] = [];

  async function createGuest(label: string, prefs: Record<string, boolean> | null) {
    const email = `t261-${label}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@test.local`;
    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        firstName: "Voyageur",
        lastName: label,
        role: "customer",
        notificationPrefs: prefs,
      })
      .returning();
    userIds.push(user.id);
    return user;
  }

  async function createBooking(input: {
    userId: string;
    email: string;
    checkIn: string;
    checkOut: string;
    status: string;
    paymentStatus: string;
  }) {
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: `MBB-T261-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        userId: input.userId,
        propertyId,
        roomId,
        status: input.status,
        paymentStatus: input.paymentStatus,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        numNights: 2,
        numAdults: 2,
        guestFirstName: "Voyageur",
        guestLastName: "T261",
        guestEmail: input.email,
        subtotal: "200.00",
        total: "200.00",
        currency: "EUR",
        commissionRate,
        // Colonnes NOT NULL sans défaut : montants de commission du séjour.
        commissionAmount: "30.00",
        netToHost: "170.00",
      })
      .returning();
    bookingIds.push(booking.id);
    return booking;
  }

  beforeAll(async () => {
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const lifecycle = await import("./booking-lifecycle-emails");
    sendBookingReminders = lifecycle.sendBookingReminders;
    sendReviewRequests = lifecycle.sendReviewRequests;

    // Réutilise une annonce/chambre du seed : aucune création de bien, et le
    // nettoyage ne touche que les lignes créées ici.
    const [property] = await db.select().from(schema.properties).limit(1);
    propertyId = property.id;
    commissionRate = String(property.commissionRate ?? "15.00");
    const [room] = await db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.propertyId, propertyId))
      .limit(1);
    roomId = room.id;
  });

  afterAll(async () => {
    if (bookingIds.length) {
      await db.delete(schema.emailOutbox).where(
        inArray(
          schema.emailOutbox.eventKey,
          bookingIds.flatMap((id) => [
            `booking-reminder:${id}:j3`,
            `booking-reminder:${id}:j1`,
            `review-request:${id}`,
          ]),
        ),
      );
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    }
    if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds));
  });

  it("rappels J-3 : coupés pour un compte réglé, envoyés pour un compte hérité", async () => {
    const optedOut = await createGuest("off", { stayReminders: false });
    const inherited = await createGuest("inherit", null);

    const stayIn = iso(3);
    const muted = await createBooking({
      userId: optedOut.id,
      email: optedOut.email,
      checkIn: stayIn,
      checkOut: iso(5),
      status: "confirmed",
      paymentStatus: "paid",
    });
    const kept = await createBooking({
      userId: inherited.id,
      email: inherited.email,
      checkIn: stayIn,
      checkOut: iso(5),
      status: "confirmed",
      paymentStatus: "paid",
    });

    await sendBookingReminders(new Date());

    // Le compte hérité a bien sa ligne d'outbox, le compte réglé aucune —
    // la base de développement peut contenir d'autres réservations du seed :
    // on n'affirme donc que sur les réservations créées ici.
    const keptRows = await db
      .select({ eventKey: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `booking-reminder:${kept.id}:j3`));
    expect(keptRows).toHaveLength(1);
    const mutedRows = await db
      .select({ eventKey: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `booking-reminder:${muted.id}:j3`));
    expect(mutedRows).toHaveLength(0);
  });

  it("demandes d'avis : rien pour le compte coupé, une pour le compte hérité", async () => {
    const optedOut = await createGuest("off2", { reviewRequests: false });
    const inherited = await createGuest("inherit2", null);

    const stayOut = iso(-1);
    const muted = await createBooking({
      userId: optedOut.id,
      email: optedOut.email,
      checkIn: iso(-3),
      checkOut: stayOut,
      status: "completed",
      paymentStatus: "paid",
    });
    const kept = await createBooking({
      userId: inherited.id,
      email: inherited.email,
      checkIn: iso(-3),
      checkOut: stayOut,
      status: "completed",
      paymentStatus: "paid",
    });

    await sendReviewRequests(new Date());

    const keptRows = await db
      .select({ eventKey: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `review-request:${kept.id}`));
    expect(keptRows).toHaveLength(1);
    const mutedRows = await db
      .select({ eventKey: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `review-request:${muted.id}`));
    expect(mutedRows).toHaveLength(0);
  });
});
