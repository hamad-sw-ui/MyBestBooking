import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-234 (audit n°3, F3) — une demande expirée ne bloque plus les dates.
 *
 * Constat d'audit : le contrôle de chevauchement ignore `pending`
 * (`ne(status,'cancelled')`) et la libération dépendait du cron quotidien. Une
 * demande morte depuis 20 h empêchait donc encore une nouvelle réservation
 * (409 reproduit), alors que l'expiration n'était « paresseuse » que de nom.
 *
 * L'expiration est désormais exécutée **dans la transaction du tunnel**, bornée
 * à la chambre et à la fenêtre demandées. Ce test crée une demande expirée sur
 * des dates libres puis vérifie qu'une seconde demande sur les mêmes dates est
 * acceptée — et qu'une demande encore valide, elle, bloque toujours.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const connection = await pool.connect();
  await connection.query("SELECT 1");
  connection.release();
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

dbTest("T-234 — expiration paresseuse des demandes dans le tunnel", () => {
  let POST: (req: unknown) => Promise<Response>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;

  let customerId = "";
  let propertyId = "";
  let roomId = "";
  let originalQuantity: number | null = null;
  const createdBookingIds: string[] = [];

  const STAY = { checkIn: "2027-03-10", checkOut: "2027-03-13" };
  const LIVE_STAY = { checkIn: "2027-04-10", checkOut: "2027-04-13" };

  /**
   * Valeurs d'une réservation `pending` complète : copie d'une ligne réelle du
   * seed (beaucoup de colonnes NOT NULL) moins les champs que le test pilote.
   */
  async function bookingFixture(opts: {
    reference: string;
    checkIn: string;
    checkOut: string;
    requestExpiresAt: Date;
  }) {
    const { eq } = await import("drizzle-orm");
    const [template] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.roomId, roomId))
      .limit(1);
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      cancelledAt: _cancelledAt,
      benefitsReleasedAt: _benefitsReleasedAt,
      ...rest
    } = template;
    return {
      ...rest,
      bookingReference: opts.reference,
      userId: customerId,
      propertyId,
      roomId,
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      status: "pending" as const,
      paymentStatus: "pending" as const,
      paymentIntentId: null,
      paymentExpiresAt: null,
      cancellationReason: null,
      requestExpiresAt: opts.requestExpiresAt,
    };
  }

  async function postBooking(stay: { checkIn: string; checkOut: string }) {
    const { NextRequest } = await import("next/server");
    const request = new NextRequest("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId,
        roomId,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        numAdults: 2,
        guestFirstName: "Client",
        guestLastName: "T234",
        guestEmail: `t234-${Date.now()}@test.local`,
        isGuestBooking: true,
      }),
    });
    return POST(request);
  }

  beforeAll(async () => {
    POST = (await import("./route")).POST as unknown as typeof POST;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const { eq } = await import("drizzle-orm");
    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    const [customer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    customerId = customer.id;
    getCurrentUser.mockResolvedValue({
      id: customerId,
      role: "customer",
      email: "customer@mybestbooking.com",
    });

    const [property] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.hostId, host.id))
      .limit(1);
    propertyId = property.id;
    const [room] = await db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.propertyId, propertyId))
      .limit(1);
    roomId = room.id;

    // Stock structurel ramené à 1 chambre : sans cela, un chevauchement sur une
    // chambre « quantité 3 » n'est pas bloquant et le test ne prouverait rien.
    // (`quantity` est restaurée en afterAll.)
    originalQuantity = room.quantity;
    await db
      .update(schema.rooms)
      .set({ quantity: 1 })
      .where(eq(schema.rooms.id, roomId));
  });

  afterAll(async () => {
    if (!db) return;
    const { eq, inArray } = await import("drizzle-orm");
    if (createdBookingIds.length > 0) {
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, createdBookingIds));
    }
    if (originalQuantity !== null) {
      await db
        .update(schema.rooms)
        .set({ quantity: originalQuantity })
        .where(eq(schema.rooms.id, roomId));
    }
  });

  it("purge la demande expirée du créneau et accepte la nouvelle", async () => {
    const { eq } = await import("drizzle-orm");

    // 1. Une demande `pending` dont l'échéance est dépassée depuis 1 h.
    const [stale] = await db
      .insert(schema.bookings)
      .values(
        await bookingFixture({
          reference: `T234-${Date.now().toString(36)}`,
          checkIn: STAY.checkIn,
          checkOut: STAY.checkOut,
          requestExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
        }),
      )
      .returning({ id: schema.bookings.id });
    createdBookingIds.push(stale.id);

    // 2. La même fenêtre doit rester réservable (avant le correctif : 409,
    //    car la demande morte comptait encore comme occupante).
    const accepted = await postBooking(STAY);
    expect(accepted.status).toBe(201);
    const body = (await accepted.json()) as { booking: { id: string } };
    createdBookingIds.push(body.booking.id);

    // 3. L'ancienne demande est annulée au motif d'expiration, échéance purgée.
    const [after] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, stale.id));
    expect(after.status).toBe("cancelled");
    expect(after.cancellationReason).toContain("expirée");
    expect(after.requestExpiresAt).toBeNull();

    // 4. Non-régression : une demande encore valide bloque toujours (409).
    const [live] = await db
      .insert(schema.bookings)
      .values(
        await bookingFixture({
          reference: `T234L-${Date.now().toString(36)}`,
          checkIn: LIVE_STAY.checkIn,
          checkOut: LIVE_STAY.checkOut,
          requestExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        }),
      )
      .returning({ id: schema.bookings.id });
    createdBookingIds.push(live.id);

    const blocked = await postBooking(LIVE_STAY);
    // Nettoyage garanti même si l'assertion échoue (pas de résidu en base).
    if (blocked.status === 201) {
      const created = (await blocked.clone().json()) as { booking?: { id: string } };
      if (created.booking?.id) createdBookingIds.push(created.booking.id);
    }
    expect(blocked.status).toBe(409);
    const [liveAfter] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, live.id));
    expect(liveAfter.status).toBe("pending");
    expect(liveAfter.requestExpiresAt).not.toBeNull();
  });

  it("le stock lu (calendrier) ne compte plus une demande expirée", async () => {
    const { eq } = await import("drizzle-orm");
    const { loadBookedCounts } = await import("@/lib/room-stock");

    const [stale] = await db
      .insert(schema.bookings)
      .values(
        await bookingFixture({
          reference: `T234S-${Date.now().toString(36)}`,
          checkIn: "2027-06-10",
          checkOut: "2027-06-13",
          requestExpiresAt: new Date(Date.now() - 5 * 60 * 1000),
        }),
      )
      .returning({ id: schema.bookings.id });
    createdBookingIds.push(stale.id);
    const [live] = await db
      .insert(schema.bookings)
      .values(
        await bookingFixture({
          reference: `T234V-${Date.now().toString(36)}`,
          checkIn: "2027-08-10",
          checkOut: "2027-08-13",
          requestExpiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000),
        }),
      )
      .returning({ id: schema.bookings.id });
    createdBookingIds.push(live.id);

    const counts = await loadBookedCounts(roomId, "2027-06-10", "2027-08-12");
    expect(counts["2027-06-11"] ?? 0).toBe(0); // demande morte → non occupante
    expect(counts["2027-08-11"] ?? 0).toBe(1); // demande vivante → occupante

    const [staleAfter] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, stale.id));
    // La lecture n'écrit pas : la purge reste le fait du tunnel/cron.
    expect(staleAfter.status).toBe("pending");
  });
});
