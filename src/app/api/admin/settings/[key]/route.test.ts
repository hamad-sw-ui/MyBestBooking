import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-159 (audit n°29) — PATCH /api/admin/settings/[key] : corps partiel
 * fusionné sur la valeur persistée (envoyer la section entière reste
 * accepté) ; erreur Zod → { error } seulement (plus d'`issues` internes).
 * Intégration DB réelle (skip si indisponible), auth admin mockée.
 * Restaure la valeur d'origine en afterAll.
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("T-159 — PATCH settings partiel (merge + erreurs sans issues)", () => {
  let PATCH: typeof import("./route").PATCH;
  let GET: typeof import("./route").GET;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let adminId = "";
  let original: Record<string, unknown> | null = null;

  beforeAll(async () => {
    const routeMod = await import("./route");
    PATCH = routeMod.PATCH;
    GET = routeMod.GET;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;
    const { eq } = await import("drizzle-orm");
    const [admin] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "admin@mybestbooking.com"))
      .limit(1);
    if (!admin) throw new Error("Seed non appliqué (admin introuvable)");
    adminId = admin.id;
    getCurrentUser.mockResolvedValue(admin);
  });

  afterAll(async () => {
    // Restaure la valeur initiale (GET lit avec defaults ; on ne restaure
    // que si une valeur a réellement été persistée).
    if (original) {
      const [row] = await db
        .select()
        .from(schema.appSettings)
        .where((await import("drizzle-orm")).eq(schema.appSettings.key, "general"))
        .limit(1);
      if (row && original) {
        await db
          .update(schema.appSettings)
          .set({ value: original })
          .where((await import("drizzle-orm")).eq(schema.appSettings.key, "general"));
      } else {
        await db
          .insert(schema.appSettings)
          .values({ key: "general", value: original })
          .onConflictDoNothing({ target: schema.appSettings.key });
      }
    }
  });

  async function callPatch(body: unknown): Promise<Response> {
    const req = new Request("http://localhost/api/admin/settings/general", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return PATCH(req as any, { params: Promise.resolve({ key: "general" }) } as any);
  }

  it("corps partiel → fusion : champ modifié, autres préservés", async () => {
    const before = await GET(new Request("http://localhost/api/admin/settings/general") as any, {
      params: Promise.resolve({ key: "general" }),
    } as any);
    const bj = (await before.json()) as { value: Record<string, unknown> };
    original = bj.value as Record<string, unknown>;
    const siteNameBefore = bj.value.siteName;
    const supportEmailBefore = bj.value.supportEmail;

    const res = await callPatch({ siteName: "MBB-T159" });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { value: Record<string, unknown> };
    expect(j.value.siteName).toBe("MBB-T159");
    expect(j.value.supportEmail).toBe(supportEmailBefore);
    expect(j.value.siteName).not.toBe(siteNameBefore);

    // GET confirme la persistance.
    const after = await GET(new Request("http://localhost/api/admin/settings/general") as any, {
      params: Promise.resolve({ key: "general" }),
    } as any);
    const aj = (await after.json()) as { value: Record<string, unknown> };
    expect(aj.value.siteName).toBe("MBB-T159");
    expect(aj.value.supportEmail).toBe(supportEmailBefore);

    // Restaure immédiatement pour ne pas polluer les autres tests.
    await callPatch(original);
  });

  it("Zod invalide → 400 avec { error } seul (aucun champ issues)", async () => {
    const res = await callPatch({ siteName: "" });
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("error");
    expect(text).not.toContain("issues");
    expect(text).not.toContain("path");
  });
});
