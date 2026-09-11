import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-246 (audit n°5, A1) — la gestion multi-listes des favoris s'arrêtait au
 * milieu du chemin :
 *
 * 1. `GET /api/wishlists` ne triait pas, alors que le cœur écrivait dans
 *    `wishlists[0]` et que la page affichait les listes par date décroissante :
 *    le favori pouvait atterrir dans une autre liste que celle affichée ;
 * 2. `updateWishlistSchema` refusait `name` (`.strict()`), donc aucun renommage
 *    n'était possible ;
 * 3. aucun moyen de **déplacer** un favori d'une liste à une autre.
 *
 * Contrats vérifiés : ordre stable + `defaultWishlistId`, renommage via PATCH
 * (et non-régression des appels partage/rotation), déplacement transactionnel
 * (`POST /api/wishlists/move`) avec refus des cas invalides.
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

dbTest("T-246 — favoris multi-listes (ordre, renommage, déplacement)", () => {
  let GET: () => Promise<Response>;
  let PATCH: (req: unknown) => Promise<Response>;
  let MOVE: (req: unknown) => Promise<Response>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let customerId = "";
  let otherUserId = "";
  let olderListId = "";
  let newerListId = "";
  let otherListId = "";
  let propertyId = "";
  let otherPropertyId = "";

  async function callPATCH(body: Record<string, unknown>) {
    const { NextRequest } = await import("next/server");
    return PATCH(
      new NextRequest("http://localhost/api/wishlists", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  async function callMOVE(body: Record<string, unknown>) {
    const { NextRequest } = await import("next/server");
    return MOVE(
      new NextRequest("http://localhost/api/wishlists/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  beforeAll(async () => {
    GET = (await import("./route")).GET as unknown as typeof GET;
    PATCH = (await import("./route")).PATCH as unknown as typeof PATCH;
    MOVE = (await import("./move/route")).POST as unknown as typeof MOVE;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const { eq, inArray } = await import("drizzle-orm");
    const auth = await import("@/lib/auth");
    const getCurrentUser = auth.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const [customer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    customerId = customer.id;
    getCurrentUser.mockResolvedValue({ id: customerId, role: "customer", email: customer.email });

    const [other] = await db
      .insert(schema.users)
      .values({
        email: `t246-other-${Date.now()}@test.local`,
        firstName: "Autre",
        lastName: "Voyageur",
      })
      .returning();
    otherUserId = other.id;

    const properties = await db
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .limit(2);
    propertyId = properties[0]!.id;
    otherPropertyId = properties[1]!.id;

    // Deux listes du même utilisateur : la plus ancienne doit rester la liste
    // par défaut, quelle que soit l'ordre d'insertion.
    const [newer] = await db
      .insert(schema.wishlists)
      .values({ userId: customerId, name: "T246 récente" })
      .returning();
    newerListId = newer.id;
    const [older] = await db
      .insert(schema.wishlists)
      .values({ userId: customerId, name: "T246 ancienne", createdAt: new Date(Date.now() - 60_000) })
      .returning();
    olderListId = older.id;
    const [foreign] = await db
      .insert(schema.wishlists)
      .values({ userId: otherUserId, name: "T246 tiers" })
      .returning();
    otherListId = foreign.id;

    await db
      .insert(schema.wishlistItems)
      .values({ wishlistId: olderListId, propertyId });
  });

  afterAll(async () => {
    if (!db) return;
    const { eq, inArray } = await import("drizzle-orm");
    await db.delete(schema.wishlistItems).where(inArray(schema.wishlistItems.wishlistId, [olderListId, newerListId, otherListId]));
    await db.delete(schema.wishlists).where(inArray(schema.wishlists.id, [olderListId, newerListId, otherListId]));
    await db.delete(schema.users).where(eq(schema.users.id, otherUserId));
  });

  it("GET : ordre stable + defaultWishlistId = plus ancienne liste", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      wishlists: { id: string; name: string }[];
      defaultWishlistId: string | null;
    };
    const ids = body.wishlists.map((w) => w.id);
    expect(ids.indexOf(olderListId)).toBeLessThan(ids.indexOf(newerListId));
    // La liste par défaut est **la première de l'ordre renvoyé** : c'est
    // exactement la cible que le cœur utilise (`wishlists[0]` avant T-246),
    // désormais déterministe.
    expect(body.defaultWishlistId).toBe(ids[0]);
  });

  it("PATCH : renomme sans toucher au partage, et refuse un nom vide", async () => {
    const before = await GET();
    const beforeBody = (await before.json()) as { wishlists: { id: string; shareToken: string | null }[] };
    const shareTokenBefore = beforeBody.wishlists.find((w) => w.id === newerListId)?.shareToken ?? null;

    const renamed = await callPATCH({ wishlistId: newerListId, name: "  Vacances 2027  " });
    expect(renamed.status).toBe(200);
    const body = (await renamed.json()) as {
      wishlist: { name: string; isPublic: boolean; shareToken?: string | null };
    };
    expect(body.wishlist.name).toBe("Vacances 2027"); // trim appliqué
    expect(body.wishlist.shareToken ?? null).toBe(shareTokenBefore); // partage intact

    expect((await callPATCH({ wishlistId: newerListId, name: "   " })).status).toBe(400);
    expect((await callPATCH({ wishlistId: newerListId, name: "x".repeat(81) })).status).toBe(400);
    // Non-régression : un PATCH de partage sans `name` ne renomme rien.
    const sharePatch = await callPATCH({ wishlistId: newerListId, isPublic: true });
    expect(sharePatch.status).toBe(200);
    const shareBody = (await sharePatch.json()) as { wishlist: { name: string; isPublic: boolean } };
    expect(shareBody.wishlist.name).toBe("Vacances 2027");
    expect(shareBody.wishlist.isPublic).toBe(true);
    if (shareBody.wishlist && "shareToken" in shareBody.wishlist) {
      await callPATCH({ wishlistId: newerListId, isPublic: false });
    }
  });

  it("POST /move : déplace le favori sans le dupliquer ni le perdre", async () => {
    const moved = await callMOVE({
      propertyId,
      fromWishlistId: olderListId,
      toWishlistId: newerListId,
    });
    expect(moved.status).toBe(200);
    expect(((await moved.json()) as { moved: boolean }).moved).toBe(true);

    const { eq, and } = await import("drizzle-orm");
    const source = await db
      .select()
      .from(schema.wishlistItems)
      .where(and(eq(schema.wishlistItems.wishlistId, olderListId), eq(schema.wishlistItems.propertyId, propertyId)));
    const target = await db
      .select()
      .from(schema.wishlistItems)
      .where(and(eq(schema.wishlistItems.wishlistId, newerListId), eq(schema.wishlistItems.propertyId, propertyId)));
    expect(source).toHaveLength(0);
    expect(target).toHaveLength(1);
  });

  it("POST /move : refuse les cas invalides sans rien modifier", async () => {
    // Même liste source et cible.
    const same = await callMOVE({
      propertyId: otherPropertyId,
      fromWishlistId: newerListId,
      toWishlistId: newerListId,
    });
    expect(same.status).toBe(400);
    expect(((await same.json()) as { issues?: unknown[] }).issues?.length).toBeGreaterThan(0);

    // Liste d'un tiers → 404 (aucune information divulguée).
    const foreign = await callMOVE({
      propertyId,
      fromWishlistId: newerListId,
      toWishlistId: otherListId,
    });
    expect(foreign.status).toBe(404);

    // Favori absent de la liste source → 404, et aucune ligne créée dans la cible.
    const notThere = await callMOVE({
      propertyId: otherPropertyId,
      fromWishlistId: olderListId,
      toWishlistId: newerListId,
    });
    expect(notThere.status).toBe(404);
    const { eq, and } = await import("drizzle-orm");
    const target = await db
      .select()
      .from(schema.wishlistItems)
      .where(and(eq(schema.wishlistItems.wishlistId, newerListId), eq(schema.wishlistItems.propertyId, otherPropertyId)));
    expect(target).toHaveLength(0);
  });
});
