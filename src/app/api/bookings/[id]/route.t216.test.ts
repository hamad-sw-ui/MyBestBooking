import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, like, inArray } from "drizzle-orm";

/**
 * T-216 — gestion manuelle des états d'une réservation.
 *
 * Depuis la colonne Statut de `/dashboard/bookings`, l'hôte (ou l'admin)
 * déclenche `PUT /api/bookings/[id] { status }`. L'UI s'appuie sur
 * `availableTransitions()` ; ce test vérifie que **le serveur** arbitre
 * exactement dans le même sens (FSM + garde paiement) et journalise la
 * transition dans `audit_log`.
 *
 * Test d'intégration : auth mockée, persistance réelle (skip si DB absente).
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

dbTest("T-216 — PUT /api/bookings/[id] : transitions manuelles hôte/admin", () => {
  let PUT: typeof import("./route").PUT;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;

  let hostId = "";
  let adminId = "";
  let customerId = "";
  let customerEmail = "";
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];
  const customerState: { level: number | null; count: number | null; wallet: string | null } = {
    level: null,
    count: null,
    wallet: null,
  };

  /** Crée une réservation de test et renvoie son id. */
  async function createBooking(input: {
    status: string;
    paymentStatus: string;
    checkIn: string;
    checkOut: string;
    nights: number;
  }): Promise<string> {
    const { generateBookingReference } = await import("@/lib/utils");
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId,
        status: input.status,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        numNights: input.nights,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Statut",
        guestLastName: "T213",
        guestEmail: customerEmail,
        paymentStatus: input.paymentStatus,
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
    bookingIds.push(booking.id);
    return booking.id;
  }

  function put(bookingId: string, body: Record<string, unknown>) {
    return PUT(
      new Request("http://localhost/api/bookings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }) as never,
      { params: Promise.resolve({ id: bookingId }) } as never,
    );
  }

  beforeAll(async () => {
    const routeMod = await import("./route");
    PUT = routeMod.PUT;
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

    const [customer] = await db
      .insert(schema.users)
      .values({
        email: `t213-booking-${Date.now()}@test.local`,
        firstName: "Statut",
        lastName: "T213",
        role: "customer",
        language: "fr",
      })
      .returning();
    customerId = customer.id;
    customerEmail = customer.email;
    customerState.level = customer.bestrewardsLevel;
    customerState.count = customer.bestrewardsBookingsCount;
    customerState.wallet = customer.walletBalance;

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: `T213 Status Property ${Date.now()}`,
        slug: generateSlug(`t213-status-${Date.now()}`),
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
        name: "T213 Status Room",
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

  afterAll(async () => {
    if (bookingIds.length > 0) {
      // La confirmation/cancel produit des e-mails dans l'outbox : on nettoie
      // les traces par identifiant de réservation avant de supprimer la ligne.
      const outbox = await db
        .select({ id: schema.emailOutbox.id, eventKey: schema.emailOutbox.eventKey })
        .from(schema.emailOutbox)
        .where(like(schema.emailOutbox.eventKey, "%" + bookingIds[0].slice(0, 8) + "%"));
      const idsToDrop = outbox
        .filter((row) => bookingIds.some((id) => row.eventKey.includes(id)))
        .map((row) => row.id);
      if (idsToDrop.length > 0) {
        await db.delete(schema.emailOutbox).where(inArray(schema.emailOutbox.id, idsToDrop));
      }
      await db.delete(schema.auditLog).where(inArray(schema.auditLog.entityId, bookingIds));
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    }
    if (customerId) {
      // L'état BestRewards du compte de test a pu être modifié par la clôture.
      await db.delete(schema.users).where(eq(schema.users.id, customerId));
    }
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
  });

  it("hôte : confirme une demande en attente (pending → confirmed)", async () => {
    const id = await createBooking({
      status: "pending",
      paymentStatus: "pending",
      checkIn: "2026-11-10",
      checkOut: "2026-11-13",
      nights: 3,
    });
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });

    const res = await put(id, { status: "confirmed" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { booking: { status: string; confirmedBy: string | null } };
    expect(body.booking.status).toBe("confirmed");
    expect(body.booking.confirmedBy).toBe(hostId);

    const audit = await db
      .select({ action: schema.auditLog.action, metadata: schema.auditLog.metadata })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, id));
    const entry = audit.find((a) => a.action === "booking.status.update");
    expect(entry).toBeTruthy();
    expect((entry?.metadata as Record<string, unknown>)?.previousStatus).toBe("pending");
    expect((entry?.metadata as Record<string, unknown>)?.newStatus).toBe("confirmed");
  });

  it("hôte : refuse de clôturer un séjour non payé (409)", async () => {
    const id = await createBooking({
      status: "confirmed",
      paymentStatus: "pending",
      checkIn: "2026-07-01",
      checkOut: "2026-07-04",
      nights: 3,
    });
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });

    const res = await put(id, { status: "completed" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/paiement/i);

    const [row] = await db
      .select({ status: schema.bookings.status })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, id));
    expect(row.status).toBe("confirmed");

    // Aucune entrée d'audit pour une transition refusée.
    const audit = await db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, id));
    expect(audit.length).toBe(0);
  });

  it("hôte : clôture un séjour payé et passé (confirmed → completed)", async () => {
    const id = await createBooking({
      status: "confirmed",
      paymentStatus: "paid",
      checkIn: "2026-07-01",
      checkOut: "2026-07-04",
      nights: 3,
    });
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });

    const res = await put(id, { status: "completed" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { booking: { status: string } };
    expect(body.booking.status).toBe("completed");

    // Effet de bord métier conservé : fidélité attribuée une seule fois.
    const [booking] = await db
      .select({ loyaltyAwardedAt: schema.bookings.loyaltyAwardedAt })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, id));
    expect(booking.loyaltyAwardedAt).not.toBeNull();
  });

  it("hôte : refuse de clôturer avant la date de départ", async () => {
    const id = await createBooking({
      status: "confirmed",
      paymentStatus: "paid",
      checkIn: "2032-01-10",
      checkOut: "2032-01-13",
      nights: 3,
    });
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });

    const res = await put(id, { status: "completed" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/date de départ/i);
  });

  it("voyageur propriétaire : ne peut pas clôturer, peut annuler", async () => {
    const id = await createBooking({
      status: "confirmed",
      paymentStatus: "paid",
      checkIn: "2026-07-01",
      checkOut: "2026-07-04",
      nights: 3,
    });
    getCurrentUser.mockResolvedValue({ id: customerId, role: "customer", email: customerEmail });

    const denied = await put(id, { status: "completed" });
    expect(denied.status).toBe(400);
    expect((await (denied.json() as Promise<{ error: string }>)).error).toMatch(/uniquement annuler/i);

    const cancelled = await put(id, { status: "cancelled" });
    expect(cancelled.status).toBe(200);
    expect((await (cancelled.json() as Promise<{ booking: { status: string } }>)).booking.status).toBe(
      "cancelled",
    );

    // L'annulation (commande métier dédiée) est elle aussi tracée.
    const audit = await db
      .select({ metadata: schema.auditLog.metadata })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, id));
    const entry = audit.find(
      (a) => (a.metadata as Record<string, unknown>)?.newStatus === "cancelled",
    );
    expect(entry).toBeTruthy();
  });

  it("états terminaux : aucune transition possible (400)", async () => {
    const id = await createBooking({
      status: "cancelled",
      paymentStatus: "refunded",
      checkIn: "2026-06-01",
      checkOut: "2026-06-04",
      nights: 3,
    });
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });

    const res = await put(id, { status: "confirmed" });
    expect(res.status).toBe(400);
    expect((await (res.json() as Promise<{ error: string }>)).error).toMatch(/Transition invalide/);
  });

  it("admin : annule une demande en attente au nom de la plateforme", async () => {
    const id = await createBooking({
      status: "pending",
      paymentStatus: "pending",
      checkIn: "2026-12-20",
      checkOut: "2026-12-23",
      nights: 3,
    });
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });

    const res = await put(id, { status: "cancelled", cancellationReason: "t213" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { booking: { status: string } };
    expect(body.booking.status).toBe("cancelled");
  });
});
