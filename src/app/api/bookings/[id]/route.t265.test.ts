import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

/**
 * T-265 (audit n°7, C1) — la confirmation d'une demande `pending` re-vérifie
 * la disponibilité du bien et de la chambre (prédicats de POST /api/bookings,
 * T-233) : un bien suspendu, un hôte suspendu/supprimé ou une chambre
 * désactivée entre la demande et la confirmation → **409** au lieu d'un séjour
 * confirmé sur une fiche publique en 404.
 *
 * Test d'intégration : auth mockée, persistance réelle (skip si DB absente).
 * Les fixtures (bien, chambres, hôte dédié, réservations) sont nettoyées en
 * fin de suite, y compris les e-mails d'outbox produits par la confirmation.
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

dbTest("T-265 — PUT /api/bookings/[id] confirmed : garde de disponibilité", () => {
  let PUT: typeof import("./route").PUT;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let suspendedHostId = "";
  let customerId = "";
  let customerEmail = "";
  let propId = "";
  let suspendedPropId = "";
  let roomOkId = "";
  let roomInactiveId = "";
  let suspendedRoomId = "";
  const bookingIds: string[] = [];

  async function makeBooking(roomId: string, propertyId: string): Promise<string> {
    const { generateBookingReference } = await import("@/lib/utils");
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId,
        roomId,
        status: "pending",
        checkIn: "2032-07-01",
        checkOut: "2032-07-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Dispo",
        guestLastName: "T265",
        guestEmail: customerEmail,
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

    const [suspendedHost] = await db
      .insert(schema.users)
      .values({
        email: `t265-host-${Date.now()}@test.local`,
        firstName: "Host",
        lastName: "T265",
        role: "host",
        language: "fr",
      })
      .returning();
    suspendedHostId = suspendedHost.id;

    const [customer] = await db
      .insert(schema.users)
      .values({
        email: `t265-customer-${Date.now()}@test.local`,
        firstName: "Dispo",
        lastName: "T265",
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
        hostId: host.id,
        name: `T-265 Availability ${Date.now()}`,
        slug: generateSlug(`t265-avail-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    propId = prop.id;

    const [roomOk] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-265 Room OK",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        currency: "EUR",
        quantity: 5,
        isActive: true,
      })
      .returning();
    roomOkId = roomOk.id;

    const [roomInactive] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-265 Room Inactive",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        currency: "EUR",
        quantity: 5,
        isActive: false,
      })
      .returning();
    roomInactiveId = roomInactive.id;

    // Bien d'un hôte suspendu : le statut reste `active` (la cascade T-233
    // aurait dû le suspendre) pour isoler le filet de sécurité sur l'hôte.
    const [suspendedProp] = await db
      .insert(schema.properties)
      .values({
        hostId: suspendedHostId,
        name: `T-265 Suspended Host ${Date.now()}`,
        slug: generateSlug(`t265-suspended-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    suspendedPropId = suspendedProp.id;

    const [suspendedRoom] = await db
      .insert(schema.rooms)
      .values({
        propertyId: suspendedProp.id,
        name: "T-265 Suspended Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        currency: "EUR",
        quantity: 5,
        isActive: true,
      })
      .returning();
    suspendedRoomId = suspendedRoom.id;

    // Suspension appliquée directement (sans cascade) : le filtre hôte actif
    // doit protéger même si l'annonce est restée `active`.
    await db
      .update(schema.users)
      .set({ suspendedAt: new Date() })
      .where(eq(schema.users.id, suspendedHostId));
  });

  afterAll(async () => {
    if (bookingIds.length > 0) {
      const outbox = await db
        .select({ id: schema.emailOutbox.id, eventKey: schema.emailOutbox.eventKey })
        .from(schema.emailOutbox);
      // Pas de filtre SQL sur un préfixe : chaque réservation a ses propres
      // e-mails (confirmation voyageur + hôte) — on filtre sur les IDs complets.
      const idsToDrop = outbox
        .filter((row) => bookingIds.some((id) => row.eventKey.includes(id)))
        .map((row) => row.id);
      if (idsToDrop.length > 0) {
        await db.delete(schema.emailOutbox).where(inArray(schema.emailOutbox.id, idsToDrop));
      }
      await db.delete(schema.auditLog).where(inArray(schema.auditLog.entityId, bookingIds));
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    }
    // Ordre FK : chambres → biens → utilisateurs (le hôte dédié porte un bien).
    if (roomOkId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomOkId));
    if (roomInactiveId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomInactiveId));
    if (suspendedRoomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, suspendedRoomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (suspendedPropId) await db.delete(schema.properties).where(eq(schema.properties.id, suspendedPropId));
    if (customerId) await db.delete(schema.users).where(eq(schema.users.id, customerId));
    if (suspendedHostId) await db.delete(schema.users).where(eq(schema.users.id, suspendedHostId));
  });

  it("cas sain : la confirmation passe (200 + confirmedBy) — non-régression", async () => {
    const bookingId = await makeBooking(roomOkId, propId);
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });
    const res = await put(bookingId, { status: "confirmed" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { booking: { status: string; confirmedBy: string | null } };
    expect(body.booking.status).toBe("confirmed");
    expect(body.booking.confirmedBy).toBe(hostId);
  });

  it("bien suspendu après la demande → 409 « Hébergement non disponible », statut inchangé", async () => {
    const bookingId = await makeBooking(roomOkId, propId);
    await db.update(schema.properties).set({ status: "suspended" }).where(eq(schema.properties.id, propId));
    try {
      getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });
      const res = await put(bookingId, { status: "confirmed" });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Hébergement non disponible");
      const [row] = await db.select({ status: schema.bookings.status }).from(schema.bookings).where(eq(schema.bookings.id, bookingId));
      expect(row.status).toBe("pending");
    } finally {
      // Ré-active le bien pour les tests suivants.
      await db.update(schema.properties).set({ status: "active" }).where(eq(schema.properties.id, propId));
    }
  });

  it("hôte suspendu (annonce restée active) → 409 — le filtre hôte protège", async () => {
    const bookingId = await makeBooking(suspendedRoomId, suspendedPropId);
    // Le hôte « connecté » est le hôte suspendu propriétaire du bien.
    getCurrentUser.mockResolvedValue({ id: suspendedHostId, role: "host", email: `t265-host-${Date.now()}@test.local` });
    const res = await put(bookingId, { status: "confirmed" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Hébergement non disponible");
    const [row] = await db.select({ status: schema.bookings.status }).from(schema.bookings).where(eq(schema.bookings.id, bookingId));
    expect(row.status).toBe("pending");
  });

  it("chambre désactivée (isActive=false) → 409 « Chambre non disponible »", async () => {
    const bookingId = await makeBooking(roomInactiveId, propId);
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });
    const res = await put(bookingId, { status: "confirmed" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Chambre non disponible");
    const [row] = await db.select({ status: schema.bookings.status }).from(schema.bookings).where(eq(schema.bookings.id, bookingId));
    expect(row.status).toBe("pending");
  });
});
