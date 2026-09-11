import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray, and, like } from "drizzle-orm";

/**
 * T-272 (audit n°8, F2) — e-mail voyageur au passage `no_show`.
 *
 * Constat rejoué pendant l'audit : la transition `→ no_show` (hôte) ne
 * produisait aucun e-mail au voyageur (outbox vide, fixture MBB-T8-NOSHOW).
 *
 * Test d'intégration (DB de test) : l'auth est mockée, la persistance réelle.
 * Property/room/booking + outbox créés puis nettoyés.
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

dbTest("T-272 — no-show notifié au voyageur", () => {
  let PUT: typeof import("../app/api/bookings/[id]/route").PUT;
  let sendNoShow: (id: string) => Promise<boolean>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];

  beforeAll(async () => {
    const routeMod = await import("../app/api/bookings/[id]/route");
    PUT = routeMod.PUT;
    const libMod = await import("./no-show-notification");
    sendNoShow = libMod.sendNoShowNotificationIfNeeded;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-272 NoShow Property",
        slug: generateSlug(`t272-noshow-${Date.now()}`),
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
        name: "T-272 NoShow Room",
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

    // Utilisateur dédié : le no-show n'affecte aucun compte du seed.
    const [user] = await db
      .insert(schema.users)
      .values({
        email: `t272-noshow-${Date.now()}@test.local`,
        firstName: "NoShow",
        lastName: "T272",
        role: "customer",
        language: "fr",
      })
      .returning();

    const [b] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: user.id,
        propertyId: prop.id,
        roomId: room.id,
        status: "confirmed",
        checkIn: "2026-08-01",
        checkOut: "2026-08-03", // séjour passé → la FSM autorise le no_show
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "NoShow",
        guestLastName: "T272",
        guestEmail: user.email,
        paymentStatus: "paid",
        paymentMethod: "offline",
        paymentMethodOffline: true,
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
  });

  afterAll(async () => {
    if (bookingIds.length) {
      await db
        .delete(schema.emailOutbox)
        .where(like(schema.emailOutbox.eventKey, "no-show:%"));
      await db.delete(schema.auditLog).where(inArray(schema.auditLog.entityId, bookingIds));
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    }
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    // L'utilisateur dédié est supprimé via son email (créé avant le booking).
    await db
      .delete(schema.users)
      .where(and(like(schema.users.email, "t272-noshow-%"), like(schema.users.lastName, "T272")));
  });

  it("hôte marque le no-show → 200 + e-mail voyageur dans l'outbox", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const [b] = await db.select().from(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    const res = await PUT(
      new Request("http://localhost/api/bookings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "no_show" }),
      }) as never,
      { params: Promise.resolve({ id: b.id }) } as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { booking: { status: string } };
    expect(body.booking.status).toBe("no_show");

    const [mail] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `no-show:${b.id}`));
    expect(mail).toBeTruthy();
    expect(mail?.to).toBe(b.guestEmail);
    expect(mail?.status).toBe("sent");
    // Contenu localisé FR + référence + modalité (ni remboursé ni rémunéré).
    expect(mail?.text).toContain(b.bookingReference);
    expect(mail?.text).toContain("non-présentation");
    expect(mail?.text).toContain("ni remboursé ni rémunéré");
  });

  it("idempotent : un 2e appel direct ne duplique pas l'outbox", async () => {
    const [b] = await db.select().from(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    await expect(sendNoShow(b.id)).resolves.toBe(true);
    const rows = await db
      .select({ k: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `no-show:${b.id}`));
    expect(rows).toHaveLength(1);
  });

  it("une réservation non no_show ne produit aucun e-mail no-show (garde d'état)", async () => {
    // 2e fixture : confirmed (séjour passé) — jamais passée en no_show.
    const { generateBookingReference } = await import("@/lib/utils");
    const [u2] = await db
      .select()
      .from(schema.users)
      .where(like(schema.users.email, "t272-noshow-%"))
      .limit(1);
    const [b2] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: u2.id,
        propertyId: propId,
        roomId,
        status: "confirmed",
        checkIn: "2026-08-10",
        checkOut: "2026-08-12",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "NoShow",
        guestLastName: "T272",
        guestEmail: u2.email,
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
    bookingIds.push(b2.id);
    await expect(sendNoShow(b2.id)).resolves.toBe(false);
    const rows = await db
      .select({ k: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `no-show:${b2.id}`));
    expect(rows).toHaveLength(0);
  });
});
