import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * Test d'intégration idempotence des conversations — T-112 (§13.5).
 *
 * Garantit que la création d'une conversation est idempotente sous
 * concurrence : la clé métier unique `conversation_key` (migration
 * 0015) empêche les doublons booking/pre-booking, et la stratégie
 * `onConflictDoNothing` (route POST /api/conversations) ramène la
 * conversation existante.
 *
 * Skip automatiquement si la DB n'est pas accessible (ex : sandbox sans
 * PostgreSQL). Ne modifie que les lignes créées puis nettoyées ici.
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

dbTest("Conversation idempotente sous concurrence (T-112, §13.5)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let testHostId: string;
  let testPropId: string;
  let testRoomId: string;
  let bookingId = "";
  const conversationIds: string[] = [];
  const bookingIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { generateSlug } = await import("@/lib/utils");

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host@mybestbooking.com introuvable)");
    testHostId = host.id;

    // Property dédiée isolée du seed.
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-112 Test Property",
        slug: generateSlug(`test-t112-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    testPropId = prop.id;

    // Room dédiée (roomId NOT NULL sur bookings).
    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-112 Test Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        quantity: 1,
        isActive: true,
      })
      .returning({ id: schema.rooms.id });
    testRoomId = room.id;

    // Booking dédié (clé booking:<id>).
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: `MBB-T112-${Date.now().toString(36).toUpperCase()}`,
        userId: host.id,
        propertyId: prop.id,
        roomId: room.id,
        status: "confirmed",
        checkIn: "2027-04-01",
        checkOut: "2027-04-05",
        numNights: 4,
        numAdults: 1,
        guestFirstName: "T112",
        guestLastName: "Test",
        guestEmail: "t112@test.local",
        subtotal: "400.00",
        total: "440.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "66.00",
        netToHost: "334.00",
      })
      .returning({ id: schema.bookings.id });
    bookingIds.push(booking.id);
    bookingId = booking.id;
  });

  afterAll(async () => {
    const { eq, inArray } = await import("drizzle-orm");
    if (conversationIds.length) {
      await db.delete(schema.conversations).where(inArray(schema.conversations.id, conversationIds));
    }
    if (bookingIds.length) {
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    }
    if (testRoomId) {
      await db.delete(schema.rooms).where(eq(schema.rooms.id, testRoomId));
    }
    if (testPropId) {
      await db.delete(schema.properties).where(eq(schema.properties.id, testPropId));
    }
  });

  // Reproduit exactement la stratégie de la route POST /api/conversations.
  async function upsertConversation(values: {
    conversationKey: string;
    propertyId: string;
    userId: string;
    bookingId?: string | null;
  }) {
    await db
      .insert(schema.conversations)
      .values({
        conversationKey: values.conversationKey,
        propertyId: values.propertyId,
        userId: values.userId,
        bookingId: values.bookingId ?? null,
      })
      .onConflictDoNothing({ target: schema.conversations.conversationKey });
    const [row] = await db
      .select()
      .from(schema.conversations)
      .where((await import("drizzle-orm")).eq(schema.conversations.conversationKey, values.conversationKey))
      .limit(1);
    if (!row) throw new Error("CONVERSATION_CREATE_FAILED");
    return row;
  }

  it("deux appels séquentiels avec la même clé property → une seule conversation", async () => {
    const key = `property:${testPropId}:user:${testHostId}`;
    const a = await upsertConversation({ conversationKey: key, propertyId: testPropId, userId: testHostId });
    const b = await upsertConversation({ conversationKey: key, propertyId: testPropId, userId: testHostId });
    conversationIds.push(a.id);
    expect(a.id).toBe(b.id);

    const rows = await db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where((await import("drizzle-orm")).eq(schema.conversations.conversationKey, key));
    expect(rows.length).toBe(1);
  });

  it("insertions concurrentes (simulation double-clic/race) → pas de doublon", async () => {
    const key = `booking:${bookingId}`;
    // 5 créations simultanées, comme 5 requêtes parallèles.
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        upsertConversation({
          conversationKey: key,
          propertyId: testPropId,
          userId: testHostId,
          bookingId,
        }),
      ),
    );
    conversationIds.push(results[0].id);
    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);

    const rows = await db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where((await import("drizzle-orm")).eq(schema.conversations.conversationKey, key));
    expect(rows.length).toBe(1);
  });

  it("un insert brut en double sans onConflictDoNothing lève une violation unique", async () => {
    // Prouve que la contrainte DB (et pas seulement l'ORM) garantit
    // l'unicité : une deuxième insertion directe avec la même clé échoue.
    const key = `property:${testPropId}:user:${testHostId}:direct`;
    const [first] = await db
      .insert(schema.conversations)
      .values({ conversationKey: key, propertyId: testPropId, userId: testHostId })
      .returning({ id: schema.conversations.id });
    conversationIds.push(first.id);
    type DbError = { code?: string; message?: string; cause?: { code?: string; message?: string } };
    let caught: DbError | undefined;
    try {
      await db
        .insert(schema.conversations)
        .values({ conversationKey: key, propertyId: testPropId, userId: testHostId });
    } catch (e) {
      caught = e as DbError;
    }
    // Code SQL Postgres 23505 = unique_violation. Drizzle enveloppe
    // l'erreur pg dans `cause` ; on teste les deux niveaux. Cela prouve
    // que la contrainte DB (et pas seulement l'ORM) garantit l'unicité.
    expect(caught, "un second insert avec la même clé doit lever une erreur").toBeDefined();
    const code = caught?.cause?.code ?? caught?.code;
    const msg = `${caught?.message ?? ""} ${caught?.cause?.message ?? ""}`;
    expect(code === "23505" || /unique|duplicate|conflit/i.test(msg)).toBe(true);
  });
});
