import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

/**
 * T-273 (audit n°8, F3) — finalisation du remboursement hors plateforme.
 *
 * Constat rejoué pendant l'audit : `refundStatus` ne devenait `refunded` que
 * par le webhook Stripe ; aucun action hôte/admin n'existait (grep : aucune
 * route n'écrivait `refundStatus`). La route dédiée finalise un remboursement
 * déjà effectué hors plateforme — jamais de contact PSP.
 *
 * Test d'intégration (DB de test) : l'auth est mockée, la persistance réelle.
 * Fixtures (property/room/bookings) créés puis nettoyés (outbox + audit log).
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

dbTest("T-273 — POST /api/bookings/[id]/refund (remboursement hors plateforme)", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let otherHostId = "";
  let adminId = "";
  let customerId = "";
  let customerEmail = "";
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
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

    const [admin] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "admin@mybestbooking.com"))
      .limit(1);
    if (!admin) throw new Error("Seed non appliqué (admin introuvable)");
    adminId = admin.id;

    const stamp = Date.now();
    const [otherHost] = await db
      .insert(schema.users)
      .values({
        email: `t273-otherhost-${stamp}@test.local`,
        firstName: "Other",
        lastName: "Host",
        role: "host",
        language: "fr",
      })
      .returning();
    otherHostId = otherHost.id;

    const [customer] = await db
      .insert(schema.users)
      .values({
        email: `t273-refund-${stamp}@test.local`,
        firstName: "Refund",
        lastName: "T273",
        role: "customer",
        language: "fr",
      })
      .returning();
    customerId = customer.id;
    customerEmail = customer.email;

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-273 Refund Property",
        slug: generateSlug(`t273-refund-${stamp}`),
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
        name: "T-273 Refund Room",
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
    paymentStatus: string;
    refundStatus?: string;
    paymentIntentId?: string | null;
    paymentMethodOffline?: boolean;
  }): Promise<string> {
    const { generateBookingReference } = await import("@/lib/utils");
    const [b] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId,
        status: "confirmed",
        checkIn: "2026-08-01",
        checkOut: "2026-08-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Refund",
        guestLastName: "T273",
        guestEmail: customerEmail,
        paymentStatus: input.paymentStatus,
        refundStatus: input.refundStatus ?? "none",
        paymentIntentId: input.paymentIntentId ?? null,
        paymentMethodOffline: input.paymentMethodOffline ?? false,
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
    return b.id;
  }

  function call(id: string, body?: Record<string, unknown>) {
    return POST(
      new Request("http://localhost/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? { reason: "Remboursement effectué en espèces" }),
      }) as never,
      { params: Promise.resolve({ id }) } as never,
    );
  }

  afterAll(async () => {
    if (bookingIds.length) {
      await db
        .delete(schema.emailOutbox)
        .where(inArray(schema.emailOutbox.eventKey, bookingIds.map((id) => `refund-finalized:${id}`)));
      await db.delete(schema.auditLog).where(inArray(schema.auditLog.entityId, bookingIds));
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    }
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    for (const uid of [otherHostId, customerId]) {
      if (uid) await db.delete(schema.users).where(eq(schema.users.id, uid));
    }
  });

  it("hôte : paid hors plateforme + refundStatus none → 200, état posé, audit, e-mail", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const id = await makeBooking({ paymentStatus: "paid", paymentMethodOffline: true });

    const res = await call(id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      booking: { refundStatus: string; refundedAt: string | null; refundAmount: string };
    };
    expect(body.booking.refundStatus).toBe("refunded");
    expect(body.booking.refundedAt).toBeTruthy();
    expect(body.booking.refundAmount).toBe("200.00");

    // Trace d'audit avec le motif.
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, id));
    expect(audit?.action).toBe("booking.refund.manual");
    expect(audit?.metadata).toMatchObject({ reason: "Remboursement effectué en espèces", host: true });

    // E-mail de confirmation au voyageur.
    const [mail] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `refund-finalized:${id}`));
    expect(mail).toBeTruthy();
    expect(mail?.to).toBe(customerEmail);
    expect(mail?.text).toContain("remboursement");
  });

  it("idempotence : un 2e appel → 409 « déjà finalisé »", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const id = await makeBooking({ paymentStatus: "paid", paymentMethodOffline: true });
    await call(id);
    const res = await call(id);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("refundStatus pending (annulation en cours) → 409, jamais doublé", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const id = await makeBooking({ paymentStatus: "paid", refundStatus: "pending", paymentMethodOffline: true });
    const res = await call(id);
    expect(res.status).toBe(409);
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(b?.refundStatus).toBe("pending");
  });

  it("réservation non payée → 409", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const id = await makeBooking({ paymentStatus: "pending" });
    const res = await call(id);
    expect(res.status).toBe(409);
  });

  it("réservation payée en ligne (paymentIntentId) → 409, la voie PSP reste exclusive", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const intent = crypto.randomUUID();
    const id = await makeBooking({ paymentStatus: "paid", paymentIntentId: intent });
    const res = await call(id);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain("paiement");
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(b?.refundStatus).toBe("none");
  });

  it("le voyageur ne peut pas finaliser → 403", async () => {
    getCurrentUser.mockResolvedValue({ id: customerId, role: "customer" });
    const id = await makeBooking({ paymentStatus: "paid", paymentMethodOffline: true });
    const res = await call(id);
    expect(res.status).toBe(403);
  });

  it("un hôte tiers ne peut pas finaliser → 403", async () => {
    getCurrentUser.mockResolvedValue({ id: otherHostId, role: "host" });
    const id = await makeBooking({ paymentStatus: "paid", paymentMethodOffline: true });
    const res = await call(id);
    expect(res.status).toBe(403);
  });

  it("admin : finalisation autorisée (200)", async () => {
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin" });
    const id = await makeBooking({ paymentStatus: "paid", paymentMethodOffline: true });
    const res = await call(id, { reason: "Remboursement en espèces, reçu n°42" });
    expect(res.status).toBe(200);
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, id));
    expect(audit?.metadata).toMatchObject({ host: false, reason: "Remboursement en espèces, reçu n°42" });
  });

  it("motif manquant ou trop court → 400 (nom du champ)", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const id = await makeBooking({ paymentStatus: "paid", paymentMethodOffline: true });
    const res = await call(id, { reason: "ab" });
    expect(res.status).toBe(400);
  });

  it("champ inconnu → 400 (schéma strict)", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host" });
    const id = await makeBooking({ paymentStatus: "paid", paymentMethodOffline: true });
    const res = await call(id, { reason: "Motif valide", refundAmount: "999" });
    expect(res.status).toBe(400);
  });
});
