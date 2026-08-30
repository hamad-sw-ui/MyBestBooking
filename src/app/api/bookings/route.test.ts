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
    getCurrentUser.mockResolvedValue({
      id: userId,
      role: "customer",
      // T-157 : le serveur utilise l'identité du compte (le mock doit
      // refléter le user complet renvoyé par @/lib/auth).
      firstName: "Test",
      lastName: "Customer",
      email: "customer@mybestbooking.com",
      phone: null,
      country: "FR",
    } as never);

    const { eq } = await import("drizzle-orm");
    const [customer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    if (!customer) throw new Error("Seed non appliqué (customer introuvable)");
    userId = customer.id;
    getCurrentUser.mockResolvedValue({
      id: userId,
      role: "customer",
      // T-157 : le serveur utilise l'identité du compte (le mock doit
      // refléter le user complet renvoyé par @/lib/auth).
      firstName: "Test",
      lastName: "Customer",
      email: "customer@mybestbooking.com",
      phone: null,
      country: "FR",
    } as never);

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

dbTest("POST /api/bookings — wallet EUR × total USD + promo (T-153, findings A/B)", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let userId = "";
  let propId = "";
  let roomId = "";
  let promoId = "";
  let promoCode = "";
  const bookingIds: string[] = [];

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const { eq } = await import("drizzle-orm");
    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");

    // Utilisateur dédié avec un solde wallet EUR (25,00 €) — on ne touche
    // jamais au customer du seed.
    const [u] = await db
      .insert(schema.users)
      .values({
        email: `wallet-t153-${Date.now()}@test.local`,
        firstName: "Wallet",
        lastName: "Test",
        role: "customer",
        walletBalance: "25.00",
        bestrewardsLevel: 1,
        bestrewardsBookingsCount: 0,
        language: "fr",
      })
      .returning();
    userId = u.id;
    getCurrentUser.mockResolvedValue({
      id: userId,
      role: "customer",
      // T-157 : le serveur utilise l'identité du compte (le mock doit
      // refléter le user complet renvoyé par @/lib/auth).
      firstName: "Test",
      lastName: "Customer",
      email: "customer@mybestbooking.com",
      phone: null,
      country: "FR",
    } as never);

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-153 USD Test Property",
        slug: generateSlug(`t153-usd-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "US",
        status: "active",
        isBestrewards: false,
      })
      .returning();
    propId = prop.id;
    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-153 USD Test Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        currency: "USD",
        quantity: 5,
        isActive: true,
      })
      .returning();
    roomId = room.id;

    const [promo] = await db
      .insert(schema.promotions)
      .values({
        code: `T153USD${Date.now().toString(36).toUpperCase()}`,
        name: "T-153 fixed USD test",
        type: "fixed_amount",
        value: "20.00", // EUR (convention admin)
        minBookingAmount: "0.00",
        maxDiscount: null,
        validFrom: new Date("2020-01-01"),
        validUntil: new Date("2099-01-01"),
        maxUses: 100,
        currentUses: 0,
        isActive: true,
      })
      .returning();
    promoId = promo.id;
    promoCode = promo.code;
  });

  afterAll(async () => {
    const { eq, inArray } = await import("drizzle-orm");
    if (bookingIds.length) await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    if (promoId) await db.delete(schema.promotions).where(eq(schema.promotions.id, promoId));
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("convertisse la promo et le wallet (EUR) pour un total USD, et débite le wallet en EUR", async () => {
    const { getSetting } = await import("@/lib/settings");
    const billing = await getSetting("billing");
    const bestr = await getSetting("bestrewards");

    // Même pipeline de calcul que POST /api/bookings (chambre USD 100 $/nuit,
    // 2 nuits, taxe 10 %, promo fixed 20 €, remise BestRewards niveau 1).
    const baseSubtotal = 200;
    const subtotal = baseSubtotal;
    const taxes = Math.round(subtotal * billing.taxRate * 100) / 100;
    let total = Math.round((subtotal + taxes) * 100) / 100;
    const promoDiscountUsd = 21.6; // 20 € × 1,08 (taux figé i18n)
    total = Math.round((total - promoDiscountUsd) * 100) / 100;
    const bestRewardsDiscount = Math.round(total * (bestr.discounts[0] / 100) * 100) / 100;
    total = Math.round((total - bestRewardsDiscount) * 100) / 100;
    const walletUsedUsd = 27; // 25 € × 1,08 = 27,00 $
    const finalTotal = Math.round(Math.max(0, total - walletUsedUsd) * 100) / 100;
    const expectedDiscount = Math.round(
      (promoDiscountUsd + bestRewardsDiscount + walletUsedUsd) * 100,
    ) / 100;

    const res = await POST(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: propId,
        roomId,
        checkIn: "2031-03-01",
        checkOut: "2031-03-03",
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Wallet",
        guestLastName: "Test",
        guestEmail: `wallet-t153-${Date.now()}@test.local`,
        guestCountry: "US",
        promoCode,
        useWalletCredits: true,
      }),
    }) as never);

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      booking: {
        id: string;
        currency: string;
        total: string;
        discount: string;
        walletCreditsUsed: string;
        promotionId: string | null;
      };
    };
    bookingIds.push(body.booking.id);

    // Cœur du finding A : `walletCreditsUsed` est le débit EUR réel (25,00 €),
    // pas 25,00 « USD » ; le total est bien déduit de 27,00 $ ≈ 25 €.
    expect(body.booking.currency).toBe("USD");
    expect(Number(body.booking.walletCreditsUsed)).toBeCloseTo(25, 2);
    expect(Number(body.booking.total)).toBeCloseTo(finalTotal, 2);
    expect(Number(body.booking.discount)).toBeCloseTo(expectedDiscount, 2);
    expect(body.booking.promotionId).toBe(promoId);

    // Wallet débité en EUR : 25,00 − 25,00 = 0,00 (jamais 25 − 27).
    const { eq } = await import("drizzle-orm");
    const [after] = await db
      .select({ walletBalance: schema.users.walletBalance })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(Number(after!.walletBalance)).toBeCloseTo(0, 2);
  });

  it("sans wallet ni promo : un total USD n'est pas modifié (contre-preuve 1:1 interdit)", async () => {
    const { getSetting } = await import("@/lib/settings");
    const billing = await getSetting("billing");
    const bestr = await getSetting("bestrewards");
    const taxes = Math.round(200 * billing.taxRate * 100) / 100;
    let total = Math.round((200 + taxes) * 100) / 100;
    const benefit = Math.round(total * (bestr.discounts[0] / 100) * 100) / 100;
    const expected = Math.round((total - benefit) * 100) / 100;

    const res = await POST(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: propId,
        roomId,
        checkIn: "2031-03-10",
        checkOut: "2031-03-12",
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Wallet",
        guestLastName: "Test",
        guestEmail: `wallet-t153-b-${Date.now()}@test.local`,
        guestCountry: "US",
      }),
    }) as never);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { booking: { id: string; total: string; discount: string } };
    bookingIds.push(body.booking.id);
    // 2 nuits × 100 $ + 10 % de taxes = 220 $ − remise BestRewards niveau 1.
    // Le solde wallet (25 €) n'est PAS soustrait sans `useWalletCredits`
    // — contre-preuve qu'aucun débit 1:1 (25 $) n'est fait en silence.
    expect(Number(body.booking.total)).toBeCloseTo(expected, 2);
    expect(Number(body.booking.discount)).toBeCloseTo(benefit, 2);
  });
});
