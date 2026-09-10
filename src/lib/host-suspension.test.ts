import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * T-233 (audit n°3, F2) — la suspension d'un hôte retire ses annonces du catalogue.
 *
 * Constat d'audit, reproduit au runtime : après `PATCH /api/users/[id]/suspend`,
 * l'hôte ne pouvait plus se connecter (401) mais sa fiche répondait **200** et le
 * bien restait dans `/recherche?city=Paris`. La sanction était cosmétique.
 *
 * Ce test couvre la cascade et son caractère réversible :
 *   - suspension → annonces `active` passent en `suspended` ;
 *   - les annonces qui n'étaient pas publiées (brouillon) restent inchangées ;
 *   - réactivation → retour exact à l'état antérieur (jamais de publication
 *     accidentelle d'un brouillon) ;
 *   - idempotence (deux suspensions successives, deux réactivations).
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

dbTest("T-233 — cascade de suspension sur les annonces de l'hôte", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let suspendHostListings: typeof import("@/lib/host-suspension").suspendHostListings;
  let reactivateHostListings: typeof import("@/lib/host-suspension").reactivateHostListings;
  let otherHostListings: typeof import("@/lib/host-suspension").suspendHostListings;

  let hostId = "";
  let otherHostId = "";
  const createdPropertyIds: string[] = [];

  async function statuses(ids: string[]) {
    const { inArray } = await import("drizzle-orm");
    const rows = await db
      .select({ id: schema.properties.id, status: schema.properties.status })
      .from(schema.properties)
      .where(inArray(schema.properties.id, ids));
    return new Map(rows.map((r) => [r.id, r.status]));
  }

  beforeAll(async () => {
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const mod = await import("@/lib/host-suspension");
    suspendHostListings = mod.suspendHostListings;
    reactivateHostListings = mod.reactivateHostListings;
    otherHostListings = mod.suspendHostListings;

    const { eq, ne, and } = await import("drizzle-orm");
    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, "host"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (aucun hôte)");
    hostId = host.id;

    const [other] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.role, "host"), ne(schema.users.id, hostId)))
      .limit(1);
    otherHostId = other?.id ?? "";

    // Un jeu de trois annonces : une publiée, une en brouillon, une archivée.
    const values = [
      { status: "active" as const, slug: `t233-active-${Date.now()}` },
      { status: "draft" as const, slug: `t233-draft-${Date.now()}` },
      { status: "archived" as const, slug: `t233-archived-${Date.now()}` },
    ];
    for (const v of values) {
      const [row] = await db
        .insert(schema.properties)
        .values({
          hostId,
          name: `T-233 ${v.status}`,
          slug: v.slug,
          type: "apartment",
          city: "Paris",
          country: "FR",
          status: v.status,
        })
        .returning({ id: schema.properties.id });
      createdPropertyIds.push(row.id);
    }
  });

  afterAll(async () => {
    if (!db) return;
    const { inArray } = await import("drizzle-orm");
    if (createdPropertyIds.length > 0) {
      await db.delete(schema.properties).where(inArray(schema.properties.id, createdPropertyIds));
    }
  });

  it("suspend : les annonces publiées passent en `suspended`, les autres ne bougent pas", async () => {
    const touched = await suspendHostListings(db, hostId);
    // Toutes les annonces publiées de l'hôte (celles du seed comprises).
    expect(touched.length).toBeGreaterThanOrEqual(1);
    const map = await statuses(createdPropertyIds);
    expect(map.get(createdPropertyIds[0])).toBe("suspended"); // était active
    expect(map.get(createdPropertyIds[1])).toBe("draft");     // intact
    expect(map.get(createdPropertyIds[2])).toBe("archived");  // intact
  });

  it("idempotent : une seconde suspension ne trouve plus rien à suspendre", async () => {
    const again = await suspendHostListings(db, hostId);
    expect(again).toHaveLength(0);
    const map = await statuses(createdPropertyIds);
    expect(map.get(createdPropertyIds[0])).toBe("suspended");
  });

  it("ne touche pas les annonces d'un autre hôte", async () => {
    if (!otherHostId) return;
    const { eq } = await import("drizzle-orm");
    const before = await db
      .select({ id: schema.properties.id, status: schema.properties.status })
      .from(schema.properties)
      .where(eq(schema.properties.hostId, otherHostId));
    await suspendHostListings(db, hostId); // bruit : l'hôte déjà suspendu
    const after = await db
      .select({ id: schema.properties.id, status: schema.properties.status })
      .from(schema.properties)
      .where(eq(schema.properties.hostId, otherHostId));
    expect(after).toEqual(before);
  });

  it("réactive : restaure exactement les annonces suspendues (brouillon non publié)", async () => {
    const restored = await reactivateHostListings(db, hostId);
    expect(restored).toContain(createdPropertyIds[0]);
    const map = await statuses(createdPropertyIds);
    expect(map.get(createdPropertyIds[0])).toBe("active");
    // Régression possible : publier un brouillon « au passage ».
    expect(map.get(createdPropertyIds[1])).toBe("draft");
    expect(map.get(createdPropertyIds[2])).toBe("archived");
  });

  it("idempotent : une seconde réactivation ne republie rien", async () => {
    expect(await reactivateHostListings(db, hostId)).toHaveLength(0);
    const map = await statuses(createdPropertyIds);
    expect(map.get(createdPropertyIds[1])).toBe("draft");
  });
});
