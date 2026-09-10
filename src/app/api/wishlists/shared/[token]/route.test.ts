import { describe, it, expect, beforeAll, afterAll } from "vitest";

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const p = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const c = await p.connect();
  await c.query("SELECT 1");
  c.release();
  await p.end();
  dbAvailable = true;
} catch {}

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("GET /api/wishlists/shared/[token] (T-019, §13.5)", () => {
  let GET: typeof import("./route").GET;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let publicToken = "";
  let privateWishId = "";
  let publicWishId = "";
  let userId = "";
  const propertyIds: string[] = [];
  const itemIds: string[] = [];

  beforeAll(async () => {
    GET = (await import("./route")).GET;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { randomUUID } = await import("node:crypto");

    const [u] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    userId = u.id;

    publicToken = randomUUID();
    const [pub] = await db
      .insert(schema.wishlists)
      .values({ userId, name: "T-019 Public", isPublic: true, shareToken: publicToken })
      .returning({ id: schema.wishlists.id });
    publicWishId = pub.id;

    const stamp = Date.now();
    const [activeProp] = await db
      .insert(schema.properties)
      .values({
        hostId: userId,
        name: "T-205 Wishlist Active",
        slug: `t205-wishlist-active-${stamp}`,
        type: "hotel",
        city: "Paris",
        country: "FR",
        status: "active",
      })
      .returning({ id: schema.properties.id });
    const [archivedProp] = await db
      .insert(schema.properties)
      .values({
        hostId: userId,
        name: "T-205 Wishlist Archived",
        slug: `t205-wishlist-archived-${stamp}`,
        type: "hotel",
        city: "Paris",
        country: "FR",
        status: "archived",
      })
      .returning({ id: schema.properties.id });
    propertyIds.push(activeProp.id, archivedProp.id);
    const insertedItems = await db
      .insert(schema.wishlistItems)
      .values([
        { wishlistId: publicWishId, propertyId: activeProp.id },
        { wishlistId: publicWishId, propertyId: archivedProp.id },
      ])
      .returning({ id: schema.wishlistItems.id });
    itemIds.push(...insertedItems.map((item) => item.id));

    const [priv] = await db
      .insert(schema.wishlists)
      .values({ userId, name: "T-019 Private", isPublic: false })
      .returning({ id: schema.wishlists.id });
    privateWishId = priv.id;
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (itemIds.length) await db.delete(schema.wishlistItems).where(inArray(schema.wishlistItems.id, itemIds));
    await db.delete(schema.wishlists).where(inArray(schema.wishlists.id, [publicWishId, privateWishId]));
    if (propertyIds.length) await db.delete(schema.properties).where(inArray(schema.properties.id, propertyIds));
  });

  async function call(token: string): Promise<Response> {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(`http://x/api/wishlists/shared/${token}`);
    return GET(req, { params: Promise.resolve({ token }) });
  }

  it("token valide et wishlist publique → 200 avec name + items", async () => {
    const res = await call(publicToken);
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.name).toBe("T-019 Public");
    expect(Array.isArray(b.items)).toBe(true);
    // Ne doit PAS exposer le userId
    expect(JSON.stringify(b)).not.toContain(userId);
  });

  it("token invalide → 404", async () => {
    const res = await call("token-inconnu-xxx");
    expect(res.status).toBe(404);
  });
});
