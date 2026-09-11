import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-259 (audit n°6, B6) — des colonnes affichées en public que personne ne
 * pouvait remplir.
 *
 * - `descriptionEn` était absente des schémas d'API : `LocalizedDescription`
 *   retombait toujours sur le français, y compris pour un visiteur anglophone ;
 * - `state` était acceptée **sans borne** alors que la colonne est un
 *   `varchar(100)` (une saisie trop longue finissait en erreur 500) ;
 * - `latitude` / `longitude` existaient et `?near=` les lisait, mais aucune
 *   saisie n'existait et l'API acceptait n'importe quelle chaîne : une annonce
 *   créée par un hôte restait invisible de la recherche « autour de moi ».
 *
 * Ce test verrouille les trois : persistance, bornes (−90..90 / −180..180),
 * normalisation de la virgule décimale et effacement par chaîne vide.
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

dbTest("T-259 — description EN, région et coordonnées éditables", () => {
  let PUT: (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let POST: (req: unknown) => Promise<Response>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;

  let hostId = "";
  let propId = "";
  let initial = { descriptionEn: null as string | null, state: null as string | null, latitude: null as string | null, longitude: null as string | null };
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

  async function currentProperty() {
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.properties).where(eq(schema.properties.id, propId));
    return row;
  }

  beforeAll(async () => {
    PUT = (await import("./[id]/route")).PUT as unknown as typeof PUT;
    POST = (await import("./route")).POST as unknown as typeof POST;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    getCurrentUser = (await import("@/lib/auth")).getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const { eq } = await import("drizzle-orm");
    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (hôte introuvable)");
    hostId = host.id;
    const [prop] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.hostId, hostId))
      .limit(1);
    propId = prop.id;
    initial = {
      descriptionEn: prop.descriptionEn,
      state: prop.state,
      latitude: prop.latitude,
      longitude: prop.longitude,
    };
  });

  afterAll(async () => {
    if (!db) return;
    const { eq, inArray } = await import("drizzle-orm");
    if (propId) {
      await db.update(schema.properties).set(initial).where(eq(schema.properties.id, propId));
    }
    if (createdIds.length > 0) {
      await db.delete(schema.properties).where(inArray(schema.properties.id, createdIds));
    }
  });

  it("persiste la description EN, la région et des coordonnées (virgule acceptée)", async () => {
    asHost();
    const res = await req("PUT", `/api/properties/${propId}`, {
      descriptionEn: "A quiet studio near the old town.",
      state: "Toscane",
      latitude: "43,769",
      longitude: "11.2558",
    });
    expect(res.status).toBe(200);
    const row = await currentProperty();
    expect(row.descriptionEn).toBe("A quiet studio near the old town.");
    expect(row.state).toBe("Toscane");
    // Colonne `decimal` : la valeur revient sous forme de chaîne normalisée.
    expect(Number(row.latitude)).toBeCloseTo(43.769, 3);
    expect(Number(row.longitude)).toBeCloseTo(11.2558, 3);
  });

  it("refuse une coordonnée hors bornes et une région trop longue (400, rien n'est écrit)", async () => {
    asHost();
    expect((await req("PUT", `/api/properties/${propId}`, { latitude: "123" })).status).toBe(400);
    expect((await req("PUT", `/api/properties/${propId}`, { latitude: "abc" })).status).toBe(400);
    expect((await req("PUT", `/api/properties/${propId}`, { longitude: "-200" })).status).toBe(400);
    expect((await req("PUT", `/api/properties/${propId}`, { state: "x".repeat(120) })).status).toBe(400);
    const row = await currentProperty();
    expect(Number(row.latitude)).toBeCloseTo(43.769, 3);
    expect(row.state).toBe("Toscane");
  });

  it("efface les coordonnées avec une chaîne vide et les relit dans le bien public", async () => {
    asHost();
    const res = await req("PUT", `/api/properties/${propId}`, { latitude: "", longitude: "" });
    expect(res.status).toBe(200);
    const row = await currentProperty();
    expect(row.latitude).toBeNull();
    expect(row.longitude).toBeNull();
    // Le projecteur public portait déjà ces colonnes : elles sont désormais
    // réellement renseignables (`toPublicProperty`).
    const { toPublicProperty } = await import("@/lib/public-property");
    expect(toPublicProperty(row).state).toBe("Toscane");
    expect(toPublicProperty(row).descriptionEn).toBe("A quiet studio near the old town.");
  });

  it("accepte la région dès la création (POST)", async () => {
    asHost();
    const res = await req("POST", "/api/properties", {
      name: `T-259 test ${Date.now()}`,
      type: "apartment",
      city: "Florence",
      state: "Toscane",
      country: "IT",
    });
    expect(res.status).toBe(201);
    const payload = (await res.json()) as { property: { id: string; state: string | null } };
    createdIds.push(payload.property.id);
    expect(payload.property.state).toBe("Toscane");
  });
});
