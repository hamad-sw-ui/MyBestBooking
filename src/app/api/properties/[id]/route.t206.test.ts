import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";

/** T-206/F3/F5 — PUT générique propriété : pas de bypass du gate hôte. */

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
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

dbTest("T-206 — propriétés : gate publication et UUID", () => {
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let propId = "";
  let adminId = "";

  beforeAll(async () => {
    const routeMod = await import("./route");
    PUT = routeMod.PUT;
    DELETE = routeMod.DELETE;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const [admin] = await db.select().from(schema.users).where(eq(schema.users.email, "admin@mybestbooking.com")).limit(1);
    if (!admin) throw new Error("Seed non appliqué (admin introuvable)");
    adminId = admin.id;

    const [host] = await db
      .insert(schema.users)
      .values({
        email: `t206-host-pending-${Date.now()}@test.local`,
        firstName: "Pending",
        lastName: "Host",
        role: "host",
        approvalStatus: "pending",
        language: "fr",
      })
      .returning();
    hostId = host.id;

    const { generateSlug } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-206 Pending Host Property",
        slug: generateSlug(`t206-pending-host-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "pending",
      })
      .returning();
    propId = prop.id;
  });

  afterAll(async () => {
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    if (hostId) await db.delete(schema.users).where(eq(schema.users.id, hostId));
  });

  it("admin ne peut pas activer l'annonce d'un hôte pending via PUT générique", async () => {
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await PUT(
      new Request("http://localhost/api/properties/id", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      }) as never,
      { params: Promise.resolve({ id: propId }) } as never,
    );
    expect(res.status).toBe(409);
    const [row] = await db.select({ status: schema.properties.status }).from(schema.properties).where(eq(schema.properties.id, propId));
    expect(row.status).toBe("pending");
  });

  it("DELETE propriété avec UUID invalide retourne 400 avant la DB", async () => {
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });
    const res = await DELETE(new Request("http://localhost/api/properties/not-a-uuid", { method: "DELETE" }) as never, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    } as never);
    expect(res.status).toBe(400);
  });
});
