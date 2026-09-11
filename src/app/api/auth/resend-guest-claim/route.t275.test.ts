import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and, inArray, like, sql } from "drizzle-orm";

/**
 * T-275 (audit n°8, F5) — renvoi de l'e-mail d'activation du claim invité.
 *
 * Constat rejoué pendant l'audit : le claim invité est un e-mail **unique**
 * (eventKey idempotent `guest-claim:<id>`) + jeton 24 h ; le compte invité est
 * créé avec `passwordHash=null` (impossible de se connecter), et
 * `resend-verification` ne couvre que `email_verification` pour un
 * utilisateur **connecté** — le 1er e-mail perdu (spam) était une impasse
 * sans support.
 *
 * Test d'intégration (DB de test) : persistance réelle, limiteurs réels
 * (réinitialisés en beforeAll). Réponses **génériques** vérifiées dans tous
 * les cas de garde (anti-énumération) : même statut, même message, zéro
 * e-mail quand la garde n'est pas franchie.
 *
 * Fixtures (property/room/users/bookings/tokens/outbox) créés puis nettoyés.
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

dbTest("T-275 — POST /api/auth/resend-guest-claim (claim invité)", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let _resetRateLimit: () => void;

  let hostId = "";
  let propId = "";
  let roomId = "";
  let guestId = "";
  let guestEmail = "";
  let claimedGuestId = "";
  const bookingIds: string[] = [];

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const rl = await import("@/lib/rate-limit");
    _resetRateLimit = rl._resetRateLimit;
    _resetRateLimit();

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;

    const stamp = Date.now();
    guestEmail = `t275-guest-${stamp}@test.local`;
    const [guest] = await db
      .insert(schema.users)
      .values({
        email: guestEmail,
        firstName: "Guest",
        lastName: "T275",
        role: "customer",
        language: "fr",
      })
      .returning();
    guestId = guest.id;

    const [claimed] = await db
      .insert(schema.users)
      .values({
        email: `t275-claimed-${stamp}@test.local`,
        firstName: "Claimed",
        lastName: "T275",
        role: "customer",
        language: "fr",
      })
      .returning();
    claimedGuestId = claimed.id;
    // Compte déjà claimé (mot de passe défini) — garde d'émission non passée.
    await db
      .update(schema.users)
      .set({ passwordHash: "t275-claimed-sentinel" })
      .where(eq(schema.users.id, claimedGuestId));

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-275 Claim Property",
        slug: generateSlug(`t275-claim-${stamp}`),
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
        name: "T-275 Claim Room",
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
  });

  async function makeBooking(input: {
    userId: string;
    status: string;
    guestEmail: string;
  }): Promise<{ id: string; bookingReference: string }> {
    const { generateBookingReference } = await import("@/lib/utils");
    const [b] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: input.userId,
        propertyId: propId,
        roomId,
        status: input.status,
        checkIn: "2026-10-01",
        checkOut: "2026-10-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Guest",
        guestLastName: "T275",
        guestEmail: input.guestEmail,
        paymentStatus: "pending",
        refundStatus: "none",
        paymentIntentId: null,
        paymentMethodOffline: false,
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
    bookingIds.push(b.id);
    return { id: b.id, bookingReference: b.bookingReference };
  }

  async function call(
    body: Record<string, unknown>,
    opts: { ip?: string } = {},
  ): Promise<Response> {
    return POST(
      new Request("http://localhost/api/auth/resend-guest-claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // IP dédiée par test : le limiteur IP est en mémoire de module.
          "x-forwarded-for": opts.ip ?? `10.275.${Math.floor(Math.random() * 200) + 1}.1`,
        },
        body: JSON.stringify(body),
      }) as never,
    );
  }

  async function resentMailCount(bookingId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.emailOutbox)
      .where(like(schema.emailOutbox.eventKey, `guest-claim-resend:${bookingId}:%`));
    // count(*) pg → string ; on normalise en number.
    return Number(row?.n ?? 0);
  }

  afterAll(async () => {
    await db.delete(schema.emailOutbox).where(like(schema.emailOutbox.eventKey, "guest-claim-resend:%"));
    if (bookingIds.length) {
      await db.delete(schema.verificationTokens).where(inArray(schema.verificationTokens.userId, [guestId, claimedGuestId]));
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    }
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    await db.delete(schema.users).where(inArray(schema.users.id, [guestId, claimedGuestId]));
  });

  it("invité pending non claimé → 200 générique + e-mail renvoyé + jeton valide non consommé", async () => {
    const { id, bookingReference } = await makeBooking({
      userId: guestId,
      status: "pending",
      guestEmail,
    });

    const res = await call({ bookingReference, guestEmail });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message.toLowerCase()).toContain("activation");

    // E-mail renvoyé : eventKey distinct de l'initiale, lien de claim inclus.
    const [mail] = await db
      .select()
      .from(schema.emailOutbox)
      .where(like(schema.emailOutbox.eventKey, `guest-claim-resend:${id}:%`));
    expect(mail).toBeTruthy();
    expect(mail?.to).toBe(guestEmail);
    // Le lien est dans le HTML (bouton) ; la référence dans le texte.
    expect(mail?.html).toContain("activer-compte?token=");
    expect(mail?.text).toContain(bookingReference);

    // Jeton guest_claim émis, non consommé, TTL ≈ 24 h.
    const [token] = await db
      .select()
      .from(schema.verificationTokens)
      .where(and(eq(schema.verificationTokens.userId, guestId), eq(schema.verificationTokens.purpose, "guest_claim")));
    expect(token).toBeTruthy();
    expect(token?.usedAt).toBeNull();
    const ttlH = (token?.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(ttlH).toBeGreaterThan(23);
    expect(ttlH).toBeLessThanOrEqual(24);

    // Le compte reste à activer (le renvoi ne claim pas le compte).
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, guestId));
    expect(u?.passwordHash).toBeNull();
  });

  it("compte déjà claimé (mot de passe) → 200 générique, aucun e-mail", async () => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, claimedGuestId));
    if (!u?.email) throw new Error("Compte claimé introuvable");
    // Booking au nom exact du compte claimé (jointure par userId) : seul le
    // garde `passwordHash IS NULL` doit empêcher l'émission.
    const { id, bookingReference } = await makeBooking({
      userId: claimedGuestId,
      status: "pending",
      guestEmail: u.email,
    });
    const res = await call({ bookingReference, guestEmail: u.email });
    expect(res.status).toBe(200);
    expect(await resentMailCount(id)).toBe(0);
    const tokens = await db
      .select()
      .from(schema.verificationTokens)
      .where(eq(schema.verificationTokens.userId, claimedGuestId));
    expect(tokens).toHaveLength(0);
  });

  it("réservation non pending (confirmée) → 200 générique, aucun e-mail", async () => {
    const { id, bookingReference } = await makeBooking({
      userId: guestId,
      status: "confirmed",
      guestEmail,
    });
    const res = await call({ bookingReference, guestEmail });
    expect(res.status).toBe(200);
    expect(await resentMailCount(id)).toBe(0);
  });

  it("e-mail non concordant avec la réservation → 200 générique, aucun e-mail", async () => {
    const { id, bookingReference } = await makeBooking({
      userId: guestId,
      status: "pending",
      guestEmail,
    });
    const res = await call({
      bookingReference,
      guestEmail: `t275-mismatch-${Date.now()}@test.local`,
    });
    expect(res.status).toBe(200);
    expect(await resentMailCount(id)).toBe(0);
  });

  it("référence inconnue → 200 générique IDENTIQUE (anti-énumération)", async () => {
    const unknown = await call({
      bookingReference: "NEEXXISTE",
      guestEmail: `t275-unknown-${Date.now()}@test.local`,
    });
    expect(unknown.status).toBe(200);
    const unknownBody = (await unknown.json()) as { message: string };

    // Même message que le cas « e-mail non concordant » : impossible de
    // distinguer « référence inexistante » de « mauvais e-mail ».
    const { bookingReference } = await makeBooking({
      userId: guestId,
      status: "pending",
      guestEmail,
    });
    const mismatch = await call({
      bookingReference,
      guestEmail: `t275-mismatch2-${Date.now()}@test.local`,
    });
    const mismatchBody = (await mismatch.json()) as { message: string };
    expect(unknownBody.message).toBe(mismatchBody.message);
    expect(mismatch.status).toBe(200);
  });

  it("champ manquant / champ inconnu → 400 (schéma strict)", async () => {
    const missing = await call({ bookingReference: "ABCDEF123" });
    expect(missing.status).toBe(400);
    const strict = await call({
      bookingReference: "ABCDEF123",
      guestEmail: guestEmail,
      extra: "non",
    });
    expect(strict.status).toBe(400);
    const badEmail = await call({ bookingReference: "ABCDEF123", guestEmail: "pas-un-email" });
    expect(badEmail.status).toBe(400);
  });

  it("rate-limit email : 4e demande dans l'heure → 429 + Retry-After", async () => {
    const email = `t275-rl-email-${Date.now()}@test.local`;
    const body = { bookingReference: "NEEXXISTE", guestEmail: email };
    const ip = "10.275.email-rl.1";
    for (let i = 0; i < 3; i++) {
      const res = await call(body, { ip });
      expect(res.status).toBe(200);
    }
    const res4 = await call(body, { ip });
    expect(res4.status).toBe(429);
    expect(Number(res4.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("rate-limit IP : 11e demande dans l'heure → 429 (bornes indépendantes)", async () => {
    const ip = "10.275.ip-rl.1";
    // 10 e-mails distincts : la borne email (3/h) ne doit pas se déclencher.
    for (let i = 0; i < 10; i++) {
      const res = await call(
        { bookingReference: "NEEXXISTE", guestEmail: `t275-rl-ip-${Date.now()}-${i}@test.local` },
        { ip },
      );
      expect(res.status).toBe(200);
    }
    const res11 = await call(
      { bookingReference: "NEEXXISTE", guestEmail: `t275-rl-ip-${Date.now()}-fin@test.local` },
      { ip },
    );
    expect(res11.status).toBe(429);
    expect(Number(res11.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
