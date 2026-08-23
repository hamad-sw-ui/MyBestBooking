import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db" });
  const client = await pool.connect();
  await client.query("SELECT 1");
  client.release();
  await pool.end();
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("provider credentials vault", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let userId = "";
  let previousRows: import("@/db/schema").ProviderCredential[] = [];
  let saveProviderCredentials: typeof import("./provider-credentials").saveProviderCredentials;
  let resolveProviderCredentials: typeof import("./provider-credentials").resolveProviderCredentials;
  let removeProviderCredentials: typeof import("./provider-credentials").removeProviderCredentials;
  let providerMetadata: typeof import("./provider-credentials").providerMetadata;

  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = "a".repeat(64);
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    ({ saveProviderCredentials, resolveProviderCredentials, removeProviderCredentials, providerMetadata } = await import("./provider-credentials"));
    const { eq } = await import("drizzle-orm");
    previousRows = await db.select().from(schema.providerCredentials).where(eq(schema.providerCredentials.provider, "resend"));
    const [user] = await db.insert(schema.users).values({
      email: `provider-vault-${Date.now()}@test.local`,
      firstName: "Provider",
      lastName: "Vault",
      role: "admin",
      passwordHash: null,
    }).returning();
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await removeProviderCredentials("resend");
      if (previousRows.length) await db.insert(schema.providerCredentials).values(previousRows);
      const { eq } = await import("drizzle-orm");
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.RESEND_API_KEY;
  });

  it("stocke un override chiffré sans exposer le clair dans les métadonnées", async () => {
    process.env.RESEND_API_KEY = "re_env_fallback";
    await saveProviderCredentials("resend", { apiKey: "re_database_secret", mailFrom: "MBB <noreply@example.test>" }, userId);
    const resolved = await resolveProviderCredentials("resend");
    expect(resolved.apiKey).toBe("re_database_secret");
    const { getMailer, _resetMailer } = await import("@/lib/mail");
    _resetMailer();
    expect((await getMailer()).constructor.name).toBe("ResendMailer");

    const { eq, and } = await import("drizzle-orm");
    const [stored] = await db.select().from(schema.providerCredentials).where(and(
      eq(schema.providerCredentials.provider, "resend"),
      eq(schema.providerCredentials.name, "apiKey"),
    ));
    expect(stored.ciphertext).not.toContain("re_database_secret");
    const metadata = await providerMetadata("resend");
    expect(JSON.stringify(metadata)).not.toContain("re_database_secret");
    expect(metadata.fields.find((field) => field.name === "apiKey")?.stored).toBe(true);
  });
});

dbTest("provider credentials rotation", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let userId = "";

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const [user] = await db.insert(schema.users).values({
      email: `provider-rotation-${Date.now()}@test.local`, firstName: "Rotation", lastName: "Vault", role: "admin", passwordHash: null,
    }).returning();
    userId = user.id;
  });

  afterAll(async () => {
    const { removeProviderCredentials, clearProviderCredentialsCache } = await import("./provider-credentials");
    await removeProviderCredentials("resend");
    clearProviderCredentialsCache();
    if (userId) {
      const { eq } = await import("drizzle-orm");
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
    delete process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
  });

  it("lit l’ancienne clé pendant la rotation puis réchiffre avec la nouvelle", async () => {
    const {
      clearProviderCredentialsCache,
      resolveProviderCredentials,
      rotateProviderCredentialEncryption,
      saveProviderCredentials,
    } = await import("./provider-credentials");
    const oldKey = "b".repeat(64);
    const newKey = "c".repeat(64);
    process.env.CREDENTIALS_ENCRYPTION_KEY = oldKey;
    delete process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
    clearProviderCredentialsCache();
    await saveProviderCredentials("resend", { apiKey: "re_rotation_secret" }, userId);

    process.env.CREDENTIALS_ENCRYPTION_KEY = newKey;
    process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = oldKey;
    clearProviderCredentialsCache();
    await expect(resolveProviderCredentials("resend")).resolves.toMatchObject({ apiKey: "re_rotation_secret" });
    await expect(rotateProviderCredentialEncryption()).resolves.toMatchObject({ reencrypted: 1 });

    delete process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
    clearProviderCredentialsCache();
    await expect(resolveProviderCredentials("resend")).resolves.toMatchObject({ apiKey: "re_rotation_secret" });
  });
});
