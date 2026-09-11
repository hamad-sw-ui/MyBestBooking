import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq, like, inArray } from "drizzle-orm";

/**
 * T-269 (audit n°7, C5) — la date de confirmation est un **état**, pas un
 * dérivé : `bookings.confirmed_at` est posée dans la transaction de
 * confirmation et la timeline de la fiche dashboard l'affiche telle quelle.
 * Avant T-269, l'étape « Réservation confirmée » portait `updated_at` : après
 * un `markPaidOffline` (ou toute autre mutation), la date de confirmation
 * affichée dérivait vers la date du dernier update.
 *
 * Ce test verrouille :
 *   1. la confirmation pose `confirmed_at` (≈ maintenant) ;
 *   2. un update postérieur (markPaidOffline → `updated_at` avancé) ne fait
 *      PAS bouger `confirmed_at` ;
 *   3. la timeline rendue (RSC) porte la date de confirmation, pas celle du
 *      dernier update ;
 *   4. une ligne historique (`confirmed_at` NULL) replie sur `updated_at`
 *      (affichage d'avant T-269, inchangé).
 *
 * Test d'intégration : DB réelle, auth mockée, fixtures purgées.
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
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/bookings",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

dbTest("T-269 — confirmed_at : posée à la confirmation, stable ensuite", () => {
  let PUT: typeof import("./route").PUT;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let customerId = "";
  let customerEmail = "";
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];

  async function makeBooking(status: string): Promise<string> {
    const { generateBookingReference } = await import("@/lib/utils");
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId,
        status,
        checkIn: "2032-09-01",
        checkOut: "2032-09-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Date",
        guestLastName: "T269",
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

    const [customer] = await db
      .insert(schema.users)
      .values({
        email: `t269-customer-${Date.now()}@test.local`,
        firstName: "Date",
        lastName: "T269",
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
        name: `T-269 ConfirmedAt ${Date.now()}`,
        slug: generateSlug(`t269-confirmed-${Date.now()}`),
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
        name: "T-269 Room",
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
    if (customerId) await db.delete(schema.users).where(eq(schema.users.id, customerId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
  });

  it("confirmation pose confirmed_at ≈ maintenant", async () => {
    const before = new Date();
    const bookingId = await makeBooking("pending");
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });
    const res = await put(bookingId, { status: "confirmed" });
    expect(res.status).toBe(200);
    const [row] = await db
      .select({ confirmedAt: schema.bookings.confirmedAt, confirmedBy: schema.bookings.confirmedBy })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId));
    expect(row.confirmedBy).toBe(hostId);
    expect(row.confirmedAt).toBeTruthy();
    const confirmedMs = row.confirmedAt!.getTime();
    expect(confirmedMs).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(confirmedMs).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("un update postérieur (markPaidOffline) ne décale pas confirmed_at", async () => {
    const bookingId = await makeBooking("pending");
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });
    expect((await put(bookingId, { status: "confirmed" })).status).toBe(200);
    const [afterConfirm] = await db
      .select({ confirmedAt: schema.bookings.confirmedAt, updatedAt: schema.bookings.updatedAt })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId));

    // Avance le temps de 2 s pour que la différence de horodatage soit mesurable.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect((await put(bookingId, { markPaidOffline: true })).status).toBe(200);
    const [afterPaid] = await db
      .select({ confirmedAt: schema.bookings.confirmedAt, updatedAt: schema.bookings.updatedAt })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId));

    expect(afterPaid.updatedAt!.getTime()).toBeGreaterThan(afterConfirm.updatedAt!.getTime());
    expect(afterPaid.confirmedAt!.getTime()).toBe(afterConfirm.confirmedAt!.getTime());
  });

  it("la timeline (RSC) porte la date de confirmation, pas le dernier update", async () => {
    const bookingId = await makeBooking("pending");
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });
    expect((await put(bookingId, { status: "confirmed" })).status).toBe(200);
    const [confirmed] = await db
      .select({ confirmedAt: schema.bookings.confirmedAt })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId));
    expect(confirmed.confirmedAt).toBeTruthy();

    // Simulation d'un update postérieur LE JOUR SUIVANT (équivalent d'un
    // markPaidOffline tardif) : confirmed_at est inchangée, updated_at bouge.
    const staleDay = new Date(confirmed.confirmedAt!.getTime() + 24 * 3600 * 1000);
    await db
      .update(schema.bookings)
      .set({ updatedAt: staleDay })
      .where(eq(schema.bookings.id, bookingId));

    const { formatDate } = await import("@/lib/utils");
    const pageMod = await import("../../../dashboard/bookings/[id]/page");
    const html = renderToStaticMarkup(
      await pageMod.default({ params: Promise.resolve({ id: bookingId }) }),
    );
    const opts = { day: "numeric", month: "short", year: "numeric" } as const;
    // L'étape « Demande confirmée » porte LA date de confirmation — la date
    // du dernier update n'y apparaît pas (affichage au format de la timeline).
    const i = html.indexOf("Demande confirmée");
    expect(i).toBeGreaterThan(-1);
    const segment = html.slice(i, i + 500);
    expect(segment).toContain(formatDate(confirmed.confirmedAt!, opts, "fr"));
    expect(segment).not.toContain(formatDate(staleDay, opts, "fr"));
  });

  it("ligne historique (confirmed_at NULL) → repli sur updated_at, affichage d'avant T-269", async () => {
    // Création directe en base (contourne la route) : confirmed_at reste NULL,
    // comme toutes les lignes antérieures à T-269.
    const { generateBookingReference } = await import("@/lib/utils");
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: customerId,
        propertyId: propId,
        roomId,
        status: "confirmed",
        checkIn: "2032-10-01",
        checkOut: "2032-10-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Date",
        guestLastName: "T269",
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
    const [row] = await db
      .select({ confirmedAt: schema.bookings.confirmedAt, updatedAt: schema.bookings.updatedAt })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, booking.id));
    expect(row.confirmedAt).toBeNull();

    // Le dernier update est fixé à J+2 : la timeline DOIT afficher cette date
    // (repli = comportement d'avant T-269, inchangé pour l'existant).
    const legacyDay = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    await db
      .update(schema.bookings)
      .set({ updatedAt: legacyDay })
      .where(eq(schema.bookings.id, booking.id));

    const { formatDate } = await import("@/lib/utils");
    const pageMod = await import("../../../dashboard/bookings/[id]/page");
    const html = renderToStaticMarkup(
      await pageMod.default({ params: Promise.resolve({ id: booking.id }) }),
    );
    const i = html.indexOf("Demande confirmée");
    expect(i).toBeGreaterThan(-1);
    expect(html.slice(i, i + 500)).toContain(
      formatDate(legacyDay, { day: "numeric", month: "short", year: "numeric" }, "fr"),
    );
  });
});
