import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * Test d'intégration — T-151 : la langue choisie à l'inscription est
 * persistée et l'e-mail de vérification est localisé pour le destinataire.
 *
 * Skip automatique si la DB n'est pas accessible. `createSession` est mocké
 * (le route handler utilise next/headers `cookies()`, non disponible en
 * test node) : le contrat testé est la persistance + l'e-mail en outbox.
 * Ne modifie que les lignes créées puis nettoyées ici.
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
  return { ...actual, createSession: vi.fn(async () => "mock-session") };
});

dbTest("T-151 — register persiste language et localise l'e-mail de vérification", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let userId = "";
  const outboxKeys: string[] = [];

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const { clearSettingsCache } = await import("@/lib/settings");
    clearSettingsCache();
  });

  afterAll(async () => {
    const { eq, inArray } = await import("drizzle-orm");
    if (outboxKeys.length) {
      await db.delete(schema.emailOutbox).where(inArray(schema.emailOutbox.eventKey, outboxKeys));
    }
    if (userId) {
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
      await db.delete(schema.verificationTokens).where(eq(schema.verificationTokens.userId, userId));
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
  });

  it("language=en → user persisté en + habillage de l'e-mail en anglais", async () => {
    const email = `register-en-t151-${Date.now()}@test.local`;
    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password: "Test1234!",
        firstName: "John",
        lastName: "Doe",
        language: "en",
      }),
    });
    const res = await POST(req as never);
    const body = (await res.json()) as { user?: { id: string; language?: string } };
    userId = body.user?.id ?? "";
    const key = `email-verification:${userId}`;
    outboxKeys.push(key);
    // Contrat API existant : 200 (inchangé — pas de régression).
    expect(res.status).toBe(200);
    expect(body.user?.language).toBe("en");

    const [user] = await db
      .select({ language: schema.users.language })
      .from(schema.users)
      .where((await import("drizzle-orm")).eq(schema.users.id, userId))
      .limit(1);
    expect(user?.language).toBe("en");

    const [row] = await db
      .select()
      .from(schema.emailOutbox)
      .where((await import("drizzle-orm")).eq(schema.emailOutbox.eventKey, key))
      .limit(1);
    expect(row).toBeDefined();
    expect(row.to).toBe(email);
    // Habillage localisé pour le destinataire anglophone.
    expect(row.html).toContain("Verify my email");
    expect(row.html).toContain("Book better. Travel further.");
    expect(row.html).toContain('lang="en"');
    expect(row.html).not.toContain("Vérifier mon email");
  });

  it("la langue est validée : une valeur inconnue est rejetée en 400", async () => {
    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `register-bad-t151-${Date.now()}@test.local`,
        password: "Test1234!",
        firstName: "Jean",
        lastName: "Test",
        language: "xx",
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/langue|language|Invalid|invalide/i);
  });
});
