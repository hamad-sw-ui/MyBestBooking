import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";

/**
 * T-242 (audit n°4, constat N1) — anonymisation complète à la suppression.
 *
 * Avant ce correctif, seule la table `users` était nettoyée : l'identité
 * survivait dans `bookings.guest_*`, `email_outbox.to` et
 * `audit_log.metadata.targetEmail`. Le test vérifie :
 *   - 0 occurrence de l'adresse d'origine dans les cinq tables concernées ;
 *   - les agrégats comptables du séjour restent intacts (référence, dates,
 *     montants, devise, commission, statut) ;
 *   - la session du compte est révoquée ;
 *   - une entrée d'audit visant **un autre** utilisateur n'est pas touchée.
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

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("T-242 — anonymizeUserAccount (suppression de compte)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let anonymizeUserAccount: typeof import("@/lib/account-anonymization").anonymizeUserAccount;
  let anonymizedEmailFor: typeof import("@/lib/account-anonymization").anonymizedEmailFor;

  let hostId = "";
  let userId = "";
  let userEmail = "";
  let anonymizedEmail = "";
  let otherUserId = "";
  let otherEmail = "";
  let propId = "";
  let roomId = "";
  let bookingId = "";
  let bookingReference = "";
  let token = "";

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const mod = await import("@/lib/account-anonymization");
    anonymizeUserAccount = mod.anonymizeUserAccount;
    anonymizedEmailFor = mod.anonymizedEmailFor;

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (hôte introuvable)");
    hostId = host.id;

    const stamp = Date.now();
    userEmail = `t242-anon-${stamp}@test.local`;
    otherEmail = `t242-tiers-${stamp}@test.local`;
    const [user] = await db
      .insert(schema.users)
      .values({
        email: userEmail,
        firstName: "Anon",
        lastName: "Cible",
        role: "customer",
        language: "fr",
      })
      .returning();
    userId = user.id;
    anonymizedEmail = anonymizedEmailFor(userEmail);

    const [other] = await db
      .insert(schema.users)
      .values({
        email: otherEmail,
        firstName: "Tiers",
        lastName: "Intact",
        role: "customer",
        language: "fr",
      })
      .returning();
    otherUserId = other.id;

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-242 Property",
        slug: generateSlug(`t242-${stamp}`),
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
        name: "T-242 Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        currency: "EUR",
        quantity: 2,
        isActive: true,
      })
      .returning();
    roomId = room.id;

    bookingReference = generateBookingReference();
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference,
        userId: user.id,
        propertyId: prop.id,
        roomId: room.id,
        status: "completed",
        checkIn: "2031-05-01",
        checkOut: "2031-05-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Anon",
        guestLastName: "Cible",
        guestEmail: userEmail,
        paymentStatus: "paid",
        subtotal: "200.00",
        taxes: "20.00",
        discount: "0",
        total: "220.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "33.00",
        netToHost: "187.00",
      })
      .returning();
    bookingId = booking.id;

    // Historique d'e-mails + trace d'audit visant la cible et un tiers.
    await db.insert(schema.emailOutbox).values([
      {
        eventKey: `t242-anon-${stamp}:a`,
        to: userEmail,
        subject: "Confirmation",
        html: "<p>ok</p>",
        text: "ok",
      },
      {
        eventKey: `t242-anon-${stamp}:b`,
        to: otherEmail,
        subject: "Tiers",
        html: "<p>ok</p>",
        text: "ok",
      },
    ]);
    await db.insert(schema.auditLog).values([
      {
        actorId: hostId,
        actorEmail: "host@mybestbooking.com",
        action: "user.suspend",
        entityType: "user",
        entityId: user.id,
        metadata: { targetEmail: userEmail, reason: "test" },
      },
      {
        actorId: hostId,
        actorEmail: "host@mybestbooking.com",
        action: "user.suspend",
        entityType: "user",
        entityId: other.id,
        metadata: { targetEmail: otherEmail },
      },
    ]);

    const { createToken } = await import("@/lib/auth");
    token = await createToken(user.id, "7d", "customer");
    await db.insert(schema.sessions).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  });

  afterAll(async () => {
    if (bookingId) await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    for (const email of [userEmail, anonymizedEmail, otherEmail]) {
      if (email) await db.delete(schema.emailOutbox).where(eq(schema.emailOutbox.to, email));
    }
    for (const id of [userId, otherUserId]) {
      if (!id) continue;
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
      await db.delete(schema.auditLog).where(eq(schema.auditLog.entityId, id));
      await db.delete(schema.users).where(eq(schema.users.id, id));
    }
  });

  it("efface l'identité partout et préserve les agrégats comptables", async () => {
    await db.transaction(async (tx) => {
      await anonymizeUserAccount(tx, {
        userId,
        originalEmail: userEmail,
        anonymizedEmail,
      });
    });

    // 1) users
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(u.email).toBe(anonymizedEmail);
    expect(u.firstName).toBe("Supprimé");
    expect(u.lastName).toBe("Compte");
    expect(u.deletedAt).not.toBeNull();

    // 2) bookings : identité remplacée, agrégats intacts
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
    expect(b.guestEmail).toBe(anonymizedEmail);
    expect(b.guestFirstName).toBe("Supprimé");
    expect(b.guestLastName).toBe("Compte");
    expect(b.bookingReference).toBe(bookingReference);
    expect(b.checkIn).toBe("2031-05-01");
    expect(b.checkOut).toBe("2031-05-03");
    expect(String(b.total)).toBe("220.00");
    expect(b.currency).toBe("EUR");
    expect(String(b.commissionAmount)).toBe("33.00");
    expect(b.status).toBe("completed");

    // 3) email_outbox : l'adresse d'origine a disparu, la trace demeure
    const outbox = await db
      .select({ to: schema.emailOutbox.to, subject: schema.emailOutbox.subject })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.to, anonymizedEmail));
    expect(outbox.length).toBe(1);
    expect(outbox[0].subject).toBe("Confirmation");
    const leakedOutbox = await db
      .select({ id: schema.emailOutbox.id })
      .from(schema.emailOutbox)
      .where(sql`${schema.emailOutbox.to} = ${userEmail}`);
    expect(leakedOutbox).toHaveLength(0);

    // 4) audit_log : adresse masquée, l'entrée et le motif restent
    const auditRows = await db
      .select({ metadata: schema.auditLog.metadata })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, userId));
    expect(auditRows).toHaveLength(1);
    const meta = auditRows[0].metadata as Record<string, unknown>;
    expect(meta.targetEmail).toBe(anonymizedEmail);
    expect(meta.reason).toBe("test");
    const leakedAudit = await db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(sql`${schema.auditLog.metadata} ->> 'targetEmail' = ${userEmail}`);
    expect(leakedAudit).toHaveLength(0);

    // 5) session révoquée
    const sessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId));
    expect(sessions).toHaveLength(0);
  });

  it("ne touche ni l'identité d'un tiers, ni son historique d'e-mails", async () => {
    const [other] = await db.select().from(schema.users).where(eq(schema.users.id, otherUserId));
    expect(other.email).toBe(otherEmail);
    expect(other.firstName).toBe("Tiers");
    expect(other.deletedAt).toBeNull();

    const rows = await db
      .select({ metadata: schema.auditLog.metadata })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, otherUserId));
    expect(rows).toHaveLength(1);
    expect((rows[0].metadata as Record<string, unknown>).targetEmail).toBe(otherEmail);

    const outbox = await db
      .select({ id: schema.emailOutbox.id })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.to, otherEmail));
    expect(outbox).toHaveLength(1);
  });

  it("est idempotente : une seconde passe ne casse rien", async () => {
    await db.transaction(async (tx) => {
      await anonymizeUserAccount(tx, {
        userId,
        originalEmail: anonymizedEmail,
        anonymizedEmail,
      });
    });
    const [b] = await db
      .select({ guestEmail: schema.bookings.guestEmail, total: schema.bookings.total })
      .from(schema.bookings)
      .where(and(eq(schema.bookings.id, bookingId)));
    expect(b.guestEmail).toBe(anonymizedEmail);
    expect(String(b.total)).toBe("220.00");
  });
});
