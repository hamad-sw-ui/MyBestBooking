import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * T-225 (audit n°2, A5) — notifications d'avis.
 *
 * Vérifie au niveau outbox :
 *  - publication → e-mail à l'hôte (eventKey `review-published:<id>`) ;
 *  - modération → e-mail à l'auteur (eventKey `review-moderated:<id>:<statut>`) ;
 *  - idempotence (contrainte unique sur `email_outbox.event_key`) ;
 *  - interrupteurs admin respectés ;
 *  - un refus (`rejected`) et une publication (`approved`) produisent deux
 *    messages distincts, `pending` n'en produit aucun.
 *
 * Intégration réelle (DB de test) : lignes créées puis nettoyées.
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

const switches = {
  reviewPublished: true,
  reviewModerated: true,
};

vi.mock("@/lib/settings", () => ({
  getSetting: async () => ({ ...switches }),
}));

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("T-225 — notifications d'avis (hôte à la publication, auteur à la modération)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let notifyReviewPublished: typeof import("@/lib/review-notifications").notifyReviewPublished;
  let notifyReviewModerated: typeof import("@/lib/review-notifications").notifyReviewModerated;

  let hostId = "";
  let hostEmail = "";
  let guestId = "";
  let guestEmail = "";
  let propId = "";
  let roomId = "";
  let bookingId = "";
  let reviewId = "";

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const mod = await import("@/lib/review-notifications");
    notifyReviewPublished = mod.notifyReviewPublished;
    notifyReviewModerated = mod.notifyReviewModerated;

    const [host] = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (hôte introuvable)");
    hostId = host.id;
    hostEmail = host.email;

    const [guest] = await db
      .insert(schema.users)
      .values({
        email: `t225-review-${Date.now()}@test.local`,
        firstName: "Avis",
        lastName: "Test",
        role: "customer",
        language: "fr",
      })
      .returning();
    guestId = guest.id;
    guestEmail = guest.email;

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-225 Review Property",
        slug: generateSlug(`t225-review-${Date.now()}`),
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
        name: "T-225 Room",
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
        userId: guest.id,
        propertyId: prop.id,
        roomId: room.id,
        status: "completed",
        checkIn: "2032-05-01",
        checkOut: "2032-05-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Avis",
        guestLastName: "Test",
        guestEmail: guest.email,
        paymentStatus: "paid",
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

    const [review] = await db
      .insert(schema.reviews)
      .values({
        bookingId: booking.id,
        userId: guest.id,
        propertyId: prop.id,
        overallRating: "9.0",
        positiveComment: "Séjour impeccable",
        isVerified: true,
        status: "approved",
      })
      .returning();
    reviewId = review.id;
  });

  afterAll(async () => {
    if (reviewId) {
      await db
        .delete(schema.emailOutbox)
        .where(eq(schema.emailOutbox.eventKey, `review-published:${reviewId}`));
      await db
        .delete(schema.emailOutbox)
        .where(eq(schema.emailOutbox.eventKey, `review-moderated:${reviewId}:rejected`));
      await db
        .delete(schema.emailOutbox)
        .where(eq(schema.emailOutbox.eventKey, `review-moderated:${reviewId}:pending`));
      await db.delete(schema.reviews).where(eq(schema.reviews.id, reviewId));
    }
    if (bookingId) await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (guestId) await db.delete(schema.users).where(eq(schema.users.id, guestId));
  });

  it("publication → un e-mail à l'hôte, idempotent", async () => {
    switches.reviewPublished = true;
    expect(await notifyReviewPublished(reviewId)).toBe(true);

    const rows = await db
      .select({ to: schema.emailOutbox.to, subject: schema.emailOutbox.subject })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `review-published:${reviewId}`));
    expect(rows).toHaveLength(1);
    expect(rows[0].to).toBe(hostEmail);
    expect(rows[0].subject).toContain("T-225 Review Property");

    // Second appel (ex. retry) : eventKey unique → toujours 1 seul message.
    await notifyReviewPublished(reviewId);
    const again = await db
      .select({ id: schema.emailOutbox.id })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `review-published:${reviewId}`));
    expect(again).toHaveLength(1);
  });

  it("interrupteur coupé → aucun e-mail hôte", async () => {
    switches.reviewPublished = false;
    await db
      .delete(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `review-published:${reviewId}`));
    expect(await notifyReviewPublished(reviewId)).toBe(false);
    const rows = await db
      .select({ id: schema.emailOutbox.id })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `review-published:${reviewId}`));
    expect(rows).toHaveLength(0);
    switches.reviewPublished = true;
  });

  it("modération refusée → e-mail à l'auteur, `pending` ne notifie pas", async () => {
    switches.reviewModerated = true;
    expect(await notifyReviewModerated(reviewId, "pending")).toBe(false);
    expect(await notifyReviewModerated(reviewId, "rejected")).toBe(true);

    const rows = await db
      .select({ to: schema.emailOutbox.to, subject: schema.emailOutbox.subject })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `review-moderated:${reviewId}:rejected`));
    expect(rows).toHaveLength(1);
    expect(rows[0].to).toBe(guestEmail);
    expect(rows[0].subject).toContain("n'a pas été publié");
  });
});
