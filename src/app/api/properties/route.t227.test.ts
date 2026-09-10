import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-227 (A7) / T-228 (A8) — horaires, fuseau et labels d'hébergement.
 *
 * - A7 : les horaires et le fuseau étaient **affichés** (repli 14:00/23:00/11:00)
 *   mais absents des API : aucune saisie n'était persistée. Ils sont désormais
 *   validés (`HH:MM`, fuseau IANA reconnu) et la fenêtre d'arrivée ne peut pas
 *   être vide (fusion partielle comprise : on valide l'état résultant).
 * - A8 : `isEcoCertified`/`isBestrewards`/`isPreferred` sont une décision
 *   éditoriale — un hôte ne peut pas se les attribuer (PUT **et** POST), alors
 *   que l'admin le peut.
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
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

dbTest("T-227/T-228 — horaires, fuseau et labels d'hébergement", () => {
  let PUT: (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let POST: (req: unknown) => Promise<Response>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;

  let hostId = "";
  let adminId = "";
  let propId = "";
  let initial = { checkInFrom: "14:00", checkInUntil: "23:00", checkOutUntil: "11:00", timezone: "UTC" };
  const createdIds: string[] = [];

  async function req(method: string, path: string, body: unknown) {
    const { NextRequest } = await import("next/server");
    const request = new NextRequest(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (method === "PUT") {
      return PUT(request, { params: Promise.resolve({ id: path.split("/").pop() as string }) });
    }
    return POST(request);
  }

  const asHost = () =>
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", email: "host@mybestbooking.com" });
  const asAdmin = () =>
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: "admin@mybestbooking.com" });

  beforeAll(async () => {
    PUT = (await import("./[id]/route")).PUT as unknown as typeof PUT;
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
    if (!host) throw new Error("Seed non appliqué (hôte introuvable)");
    hostId = host.id;
    const [admin] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "admin@mybestbooking.com"))
      .limit(1);
    adminId = admin.id;

    const [prop] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.hostId, hostId))
      .limit(1);
    propId = prop.id;
    initial = {
      checkInFrom: prop.checkInFrom?.slice(0, 5) ?? "14:00",
      checkInUntil: prop.checkInUntil?.slice(0, 5) ?? "23:00",
      checkOutUntil: prop.checkOutUntil?.slice(0, 5) ?? "11:00",
      timezone: prop.timezone ?? "UTC",
    };
  });

  afterAll(async () => {
    if (!db) return;
    const { eq, inArray } = await import("drizzle-orm");
    if (propId) {
      await db
        .update(schema.properties)
        .set({
          checkInFrom: initial.checkInFrom,
          checkInUntil: initial.checkInUntil,
          checkOutUntil: initial.checkOutUntil,
          timezone: initial.timezone,
          isEcoCertified: false,
          isBestrewards: false,
          isPreferred: false,
        })
        .where(eq(schema.properties.id, propId));
    }
    if (createdIds.length > 0) {
      await db.delete(schema.properties).where(inArray(schema.properties.id, createdIds));
    }
  });

  const validPayload = () => ({
    name: `T-227 test ${Date.now()}`,
    type: "apartment" as const,
    city: "Lyon",
    country: "FR",
    addressLine: "2 rue de Test",
  });

  it("A7 — PUT persiste des horaires valides + un fuseau IANA", async () => {
    const { eq } = await import("drizzle-orm");
    asHost();
    const res = await req("PUT", `/api/properties/${propId}`, {
      checkInFrom: "15:30",
      checkInUntil: "22:00",
      checkOutUntil: "10:30",
      timezone: "America/New_York",
    });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(schema.properties).where(eq(schema.properties.id, propId));
    expect(row.checkInFrom?.slice(0, 5)).toBe("15:30");
    expect(row.checkInUntil?.slice(0, 5)).toBe("22:00");
    expect(row.checkOutUntil?.slice(0, 5)).toBe("10:30");
    expect(row.timezone).toBe("America/New_York");
  });

  it("A7 — refuse un horaire mal formé et un fuseau inconnu (400)", async () => {
    asHost();
    expect((await req("PUT", `/api/properties/${propId}`, { checkInFrom: "25:99" })).status).toBe(400);
    expect((await req("PUT", `/api/properties/${propId}`, { checkOutUntil: "9h" })).status).toBe(400);
    expect((await req("PUT", `/api/properties/${propId}`, { timezone: "Mars/Olympus" })).status).toBe(400);
  });

  it("A7 — refuse une fenêtre d'arrivée vide, y compris via fusion partielle", async () => {
    const { eq } = await import("drizzle-orm");
    asHost();
    // Les deux champs en une fois.
    expect(
      (await req("PUT", `/api/properties/${propId}`, { checkInFrom: "18:00", checkInUntil: "18:00" })).status,
    ).toBe(400);
    // Partiel : le début envoyé égale la fin persistée → état résultant vide.
    await db
      .update(schema.properties)
      .set({ checkInFrom: "15:30", checkInUntil: "22:00" })
      .where(eq(schema.properties.id, propId));
    expect((await req("PUT", `/api/properties/${propId}`, { checkInFrom: "22:00" })).status).toBe(400);
    const [row] = await db.select().from(schema.properties).where(eq(schema.properties.id, propId));
    // La valeur refusée n'a pas été écrite.
    expect(row.checkInFrom?.slice(0, 5)).toBe("15:30");
  });

  it("A7 — accepte une fenêtre à cheval sur minuit (pratique hôtelière)", async () => {
    const { eq } = await import("drizzle-orm");
    asHost();
    expect((await req("PUT", `/api/properties/${propId}`, { checkInUntil: "02:00" })).status).toBe(200);
    const [row] = await db.select().from(schema.properties).where(eq(schema.properties.id, propId));
    expect(row.checkInUntil?.slice(0, 5)).toBe("02:00");
    expect(row.checkInFrom?.slice(0, 5)).toBe("15:30");
  });

  it("A8 — PUT : label refusé à l'hôte (403), accepté pour l'admin", async () => {
    const { eq } = await import("drizzle-orm");
    asHost();
    const refused = await req("PUT", `/api/properties/${propId}`, { isEcoCertified: true });
    expect(refused.status).toBe(403);
    let [row] = await db.select().from(schema.properties).where(eq(schema.properties.id, propId));
    expect(row.isEcoCertified).toBe(false);

    asAdmin();
    const accepted = await req("PUT", `/api/properties/${propId}`, { isEcoCertified: true });
    expect(accepted.status).toBe(200);
    [row] = await db.select().from(schema.properties).where(eq(schema.properties.id, propId));
    expect(row.isEcoCertified).toBe(true);
  });

  it("A8 — POST : label refusé à l'hôte (403) sans créer d'annonce", async () => {
    const { eq, and, like } = await import("drizzle-orm");
    asHost();
    const payload = validPayload();
    const res = await req("POST", "/api/properties", { ...payload, isPreferred: true });
    expect(res.status).toBe(403);
    const created = await db
      .select()
      .from(schema.properties)
      .where(and(eq(schema.properties.hostId, hostId), like(schema.properties.name, `${payload.name}%`)));
    expect(created).toHaveLength(0);
  });

  it("A7 — POST : horaires/fuseau valides persistés, fenêtre vide refusée", async () => {
    const { like } = await import("drizzle-orm");
    asHost();
    const payload = validPayload();
    const empty = await req("POST", "/api/properties", {
      ...payload,
      checkInFrom: "16:00",
      checkInUntil: "16:00",
    });
    expect(empty.status).toBe(400);

    const ok = await req("POST", "/api/properties", {
      ...payload,
      checkInFrom: "16:00",
      checkInUntil: "20:00",
      timezone: "Europe/Paris",
    });
    expect(ok.status).toBe(201);
    const body = (await ok.json()) as { property: { id: string; checkInFrom: string; timezone: string } };
    createdIds.push(body.property.id);
    expect(body.property.checkInFrom.slice(0, 5)).toBe("16:00");
    expect(body.property.timezone).toBe("Europe/Paris");

    const rows = await db
      .select()
      .from(schema.properties)
      .where(like(schema.properties.name, `${payload.name}%`));
    for (const row of rows) if (!createdIds.includes(row.id)) createdIds.push(row.id);
  });
});
