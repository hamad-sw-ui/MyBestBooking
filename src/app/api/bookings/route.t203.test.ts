import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * T-203 — Paiement manuel : une réservation créée SANS `payOnline` ne doit
 * PAS avoir de `paymentExpiresAt` (aucun hold de paiement). Sinon le cron
 * `expirePendingBookings` annule la demande 15 min après sa création, ce qui
 * casse le scénario « paiement manuel » (l'hôte n'a pas le temps de statuer).
 *
 * Test d'intégration sur la DB de test ; `getCurrentUser` mocké (next/headers
 * indisponible en node). Property/room/booking créés puis nettoyés.
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>(
    "@/lib/auth",
  );
  return { ...actual, getCurrentUser: vi.fn() };
});

dbTest("T-203 — POST /api/bookings sans payOnline → pas d'expiration du hold", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let userId = "";
  let propId = "";
  let roomId = "";
  let bookingId = "";

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

    const [u] = await db
      .insert(schema.users)
      .values({
        email: `t203-manual-${Date.now()}@test.local`,
        firstName: "Manual",
        lastName: "Test",
        role: "customer",
        language: "fr",
      })
      .returning();
    userId = u.id;
    getCurrentUser.mockResolvedValue({
      id: userId,
      role: "customer",
      firstName: "Manual",
      lastName: "Test",
      email: u.email,
      phone: null,
      country: "FR",
    } as never);

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-203 Manual Property",
        slug: generateSlug(`t203-manual-${Date.now()}`),
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
        name: "T-203 Manual Room",
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
    if (bookingId) await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("réservation sans payOnline → paymentExpiresAt NULL (demande non expirable)", async () => {
    const res = await POST(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: propId,
        roomId,
        checkIn: "2032-04-01",
        checkOut: "2032-04-03",
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Manual",
        guestLastName: "Test",
        guestEmail: `t203-manual-${Date.now()}@test.local`,
        guestCountry: "FR",
        // Aucun `payOnline` → paiement manuel (défaut T-202).
      }),
    }) as never);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { booking: { id: string; paymentStatus: string | null; paymentExpiresAt: string | null; manualConfirmation?: boolean }; payment: unknown };
    bookingId = body.booking.id;

    // Paiement manuel : pas de paiement en ligne ni de hold expirable.
    expect(body.payment).toBeNull();
    expect(body.booking.paymentStatus).toBe("pending");
    expect(body.booking.paymentExpiresAt).toBeNull();

    // Vérifié en base : la colonne est bien NULL (le cron ne l'expirera pas).
    const [row] = await db
      .select({ paymentExpiresAt: schema.bookings.paymentExpiresAt })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId));
    expect(row!.paymentExpiresAt).toBeNull();
  });
});
