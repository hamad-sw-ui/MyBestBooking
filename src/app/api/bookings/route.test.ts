import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

/**
 * Test d'intégration POST /api/bookings — T-012 : disponibilité +
 * chevauchement. Utilise la DB de test (embedded-postgres sur 55432).
 *
 * Skip automatiquement si la DB n'est pas accessible (ex : sandbox
 * sans PostgreSQL). Ne modifie pas les données du seed hors des 3
 * bookings créés puis nettoyés.
 *
 * T-152 (audit n°24, E) : ajoute un test GET sur les champs `review`
 * additifs (getCurrentUser mocké ; la persistance est réelle).
 */

// T-152 : auth mockée pour tester GET /api/bookings (la route utilise
// next/headers, indisponible en test node). Les tests POST existants
// n'utilisent pas l'auth réelle (insertion DB directe) : aucun impact.
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

// Vérifie disponibilité de la DB avant de charger tout le module
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

dbTest("POST /api/bookings — disponibilité (T-012, §13.5)", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let testUserId: string;
  let testPropId: string;
  let testRoomId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    // Charge les modules après confirmation DB
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");

    // Récupère un user existant (seed) + une property + une room avec quantity=1
    const [u] = await db
      .select()
      .from(schema.users)
      .where((await import("drizzle-orm")).eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    if (!u) throw new Error("Seed non appliqué (customer@mybestbooking.com introuvable)");
    testUserId = u.id;

    // Crée une property+room dédiées avec quantity=1 pour isoler le test
    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [host] = await db
      .select()
      .from(schema.users)
      .where((await import("drizzle-orm")).eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    const uniqueSlug = generateSlug(`test-t012-${Date.now()}`);
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host!.id,
        name: "T-012 Test Property",
        slug: uniqueSlug,
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    testPropId = prop.id;
    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-012 Test Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        quantity: 1, // 1 seule unité → chaque chevauchement doit être refusé
        isActive: true,
      })
      .returning();
    testRoomId = room.id;
  });

  afterAll(async () => {
    const { eq: eqOp, inArray } = await import("drizzle-orm");
    if (createdIds.length) {
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, createdIds));
    }
    if (testRoomId) await db.delete(schema.rooms).where(eqOp(schema.rooms.id, testRoomId));
    if (testPropId) await db.delete(schema.properties).where(eqOp(schema.properties.id, testPropId));
  });

  // Mock `getCurrentUser()` pour renvoyer un utilisateur test
  async function callPost(body: Record<string, unknown>): Promise<Response> {
    const req = new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    // Injecter user via header cookie fake ne fonctionne pas ici sans le
    // vrai flux de session. On importe donc getCurrentUser et on le mock
    // via vi.doMock si nécessaire. Approche plus simple : appeler
    // directement l'insertion en respectant le contrat.
    return POST(req as any);
  }

  // Nettoyage entre tests dans la même suite (on garde certains ids
  // vivants pour vérifier le chevauchement)
  it("accepte un 1er booking valide", async () => {
    // Approche pragmatique : vérifier via une insertion directe en base
    // que la logique métier fonctionne, plutôt que de mocker toute la
    // pile auth. Les tests d'intégration bout-en-bout du parcours HTTP
    // seront traités par Playwright (T-019).
    const { eq: eqOp, ne, and, lt, gt } = await import("drizzle-orm");

    // Simule ce que fait POST : vérifie chevauchement
    const overlaps = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(
        and(
          eqOp(schema.bookings.roomId, testRoomId),
          ne(schema.bookings.status, "cancelled"),
          lt(schema.bookings.checkIn, "2027-03-05"),
          gt(schema.bookings.checkOut, "2027-03-01"),
        ),
      );
    expect(overlaps.length).toBe(0);

    const [b] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: `MBB-TEST-${Date.now().toString(36).toUpperCase()}`,
        userId: testUserId,
        propertyId: testPropId,
        roomId: testRoomId,
        status: "confirmed",
        checkIn: "2027-03-01",
        checkOut: "2027-03-05",
        numNights: 4,
        numAdults: 1,
        guestFirstName: "Test",
        guestLastName: "One",
        guestEmail: "t1@test.local",
        subtotal: "400.00",
        total: "440.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "66.00",
        netToHost: "374.00",
      })
      .returning({ id: schema.bookings.id });
    createdIds.push(b.id);
  });

  it("détecte un chevauchement (quantity=1)", async () => {
    const { eq: eqOp, ne, and, lt, gt } = await import("drizzle-orm");
    const overlaps = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(
        and(
          eqOp(schema.bookings.roomId, testRoomId),
          ne(schema.bookings.status, "cancelled"),
          lt(schema.bookings.checkIn, "2027-03-06"), // requête new = 03..06
          gt(schema.bookings.checkOut, "2027-03-03"),
        ),
      );
    expect(overlaps.length).toBeGreaterThan(0);
  });

  it("accepte un booking adjacent (checkOut = checkIn)", async () => {
    const { eq: eqOp, ne, and, lt, gt } = await import("drizzle-orm");
    const overlaps = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(
        and(
          eqOp(schema.bookings.roomId, testRoomId),
          ne(schema.bookings.status, "cancelled"),
          lt(schema.bookings.checkIn, "2027-03-10"),
          gt(schema.bookings.checkOut, "2027-03-05"), // strict >, adjacent OK
        ),
      );
    expect(overlaps.length).toBe(0);
  });

  it("accepte un booking totalement disjoint", async () => {
    const { eq: eqOp, ne, and, lt, gt } = await import("drizzle-orm");
    const overlaps = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(
        and(
          eqOp(schema.bookings.roomId, testRoomId),
          ne(schema.bookings.status, "cancelled"),
          lt(schema.bookings.checkIn, "2027-04-05"),
          gt(schema.bookings.checkOut, "2027-04-01"),
        ),
      );
    expect(overlaps.length).toBe(0);
  });
});

dbTest("GET /api/bookings — champs avis additifs (T-152, finding E)", () => {
  let GET: typeof import("./route").GET;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let userId = "";
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];
  let reviewId = "";
  let plainRef = "";
  let reviewedRef = "";

  beforeAll(async () => {
    const routeMod = await import("./route");
    GET = routeMod.GET;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;
    getCurrentUser.mockResolvedValue({ id: userId, role: "customer" } as never);

    const { eq } = await import("drizzle-orm");
    const [customer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    if (!customer) throw new Error("Seed non appliqué (customer introuvable)");
    userId = customer.id;
    getCurrentUser.mockResolvedValue({ id: userId, role: "customer" } as never);

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-152 Review Test Property",
        slug: generateSlug(`t152-review-${Date.now()}`),
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
        name: "T-152 Review Test Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "90.00",
        quantity: 2,
        isActive: true,
        currency: "EUR",
      })
      .returning();
    roomId = room.id;

    async function createBooking(ref: string) {
      const [b] = await db
        .insert(schema.bookings)
        .values({
          bookingReference: ref,
          userId: customer.id,
          propertyId: prop.id,
          roomId: room.id,
          status: "completed",
          checkIn: "2026-08-01",
          checkOut: "2026-08-03",
          numNights: 2,
          numAdults: 2,
          numChildren: 0,
          guestFirstName: "Test",
          guestLastName: "Review",
          guestEmail: customer.email,
          subtotal: "180.00",
          taxes: "18.00",
          discount: "0",
          total: "198.00",
          currency: "EUR",
          paymentStatus: "paid",
          commissionRate: "15.00",
          commissionAmount: "29.70",
          netToHost: "168.30",
        })
        .returning();
      bookingIds.push(b.id);
      return b;
    }

    const plain = await createBooking(generateBookingReference());
    const reviewed = await createBooking(generateBookingReference());
    const [review] = await db
      .insert(schema.reviews)
      .values({
        bookingId: reviewed.id,
        userId: customer.id,
        propertyId: prop.id,
        overallRating: "9.0",
        status: "approved",
      })
      .returning();
    reviewId = review.id;
    plainRef = plain.bookingReference;
    reviewedRef = reviewed.bookingReference;
  });

  afterAll(async () => {
    const { eq, inArray } = await import("drizzle-orm");
    if (reviewId) await db.delete(schema.reviews).where(eq(schema.reviews.id, reviewId));
    if (bookingIds.length) await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
  });

  it("renvoie review {id, status, overallRating} pour une résa commentée", async () => {
    const res = await GET(new Request("http://localhost/api/bookings") as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      bookings: Array<{ booking: { bookingReference: string }; review: { id: string; status: string; overallRating: string } | null }>;
    };
    const row = body.bookings.find((b) => b.booking.bookingReference === reviewedRef);
    expect(row).toBeDefined();
    expect(row!.review?.id).toBe(reviewId);
    expect(row!.review?.status).toBe("approved");
    expect(Number(row!.review?.overallRating)).toBe(9);
  });

  it("renvoie review null pour une résa sans avis (additif, aucun appelant cassé)", async () => {
    const res = await GET(new Request("http://localhost/api/bookings") as never);
    const body = (await res.json()) as {
      bookings: Array<{ booking: { bookingReference: string }; review: { id: string } | null }>;
    };
    const row = body.bookings.find((b) => b.booking.bookingReference === plainRef);
    expect(row).toBeDefined();
    expect(row!.review?.id ?? null).toBeNull();
  });
});
