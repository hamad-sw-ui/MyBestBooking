import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerCredentials, providerTestLogs } from "@/db/schema";

export const PROVIDERS = ["stripe", "resend", "s3"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export const PROVIDER_FIELDS: Record<ProviderName, readonly string[]> = {
  stripe: ["secretKey", "webhookSecret", "publishableKey"],
  resend: ["apiKey", "mailFrom"],
  s3: ["endpoint", "region", "bucket", "accessKey", "secretKey", "publicBaseUrl"],
};

const REQUIRED_FIELDS: Record<ProviderName, readonly string[]> = {
  stripe: ["secretKey", "webhookSecret", "publishableKey"],
  resend: ["apiKey"],
  s3: ["endpoint", "bucket", "accessKey", "secretKey"],
};

type ProviderValues = Record<string, string | undefined>;
type CacheEntry = { value: ProviderValues; expiresAt: number };
const cache = new Map<ProviderName, CacheEntry>();
const CACHE_TTL_MS = 60_000;

export class ProviderCredentialsError extends Error {}

function parseMasterKey(raw: string | undefined, envName: string): Buffer | null {
  if (!raw) return null;
  const value = /^[a-fA-F0-9]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (value.length !== 32) {
    throw new ProviderCredentialsError(`${envName} doit encoder exactement 32 octets`);
  }
  return value;
}

function masterKey(): Buffer | null {
  return parseMasterKey(process.env.CREDENTIALS_ENCRYPTION_KEY, "CREDENTIALS_ENCRYPTION_KEY");
}

/** Clé temporaire de rotation, jamais envoyée à l’UI ni stockée en DB. */
function previousMasterKey(): Buffer | null {
  return parseMasterKey(process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS, "CREDENTIALS_ENCRYPTION_KEY_PREVIOUS");
}

function envValues(provider: ProviderName): ProviderValues {
  switch (provider) {
    case "stripe":
      return {
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      };
    case "resend":
      return { apiKey: process.env.RESEND_API_KEY, mailFrom: process.env.MAIL_FROM };
    case "s3":
      return {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        bucket: process.env.S3_BUCKET,
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY,
        publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
      };
  }
}

function encrypt(value: string, key: Buffer): { ciphertext: string; iv: string; authTag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(input: { ciphertext: string; iv: string; authTag: string }, key: Buffer): string {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(input.iv, "base64"));
    decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(input.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ProviderCredentialsError("Impossible de déchiffrer une configuration provider ; vérifiez la clé maître ou restaurez une sauvegarde cohérente");
  }
}

/** Essaie la clé active, puis la clé précédente uniquement pendant une rotation. */
function decryptWithKeyring(input: { ciphertext: string; iv: string; authTag: string }, current: Buffer, previous: Buffer | null): string {
  try {
    return decrypt(input, current);
  } catch (currentError) {
    if (!previous) throw currentError;
    return decrypt(input, previous);
  }
}

export function clearProviderCredentialsCache(provider?: ProviderName): void {
  if (provider) cache.delete(provider);
  else cache.clear();
}

/** Résout DB chiffrée puis fallback env, uniquement sur le serveur. */
export async function resolveProviderCredentials(provider: ProviderName): Promise<ProviderValues> {
  const cached = cache.get(provider);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const values: ProviderValues = { ...envValues(provider) };
  const key = masterKey();
  const previous = previousMasterKey();
  if (key) {
    const rows = await db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.provider, provider));
    for (const row of rows) {
      values[row.name] = decryptWithKeyring(row, key, previous);
    }
  }
  cache.set(provider, { value: values, expiresAt: Date.now() + CACHE_TTL_MS });
  return values;
}

export async function saveProviderCredentials(
  provider: ProviderName,
  values: Record<string, string | undefined>,
  actorId: string,
): Promise<void> {
  const key = masterKey();
  if (!key) {
    throw new ProviderCredentialsError("La configuration web des providers exige CREDENTIALS_ENCRYPTION_KEY côté serveur");
  }
  const allowed = new Set(PROVIDER_FIELDS[provider]);
  for (const [name, value] of Object.entries(values)) {
    if (!allowed.has(name) || value === undefined || value === "") continue;
    const sealed = encrypt(value, key);
    await db
      .insert(providerCredentials)
      .values({ provider, name, ...sealed, updatedBy: actorId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [providerCredentials.provider, providerCredentials.name],
        set: { ...sealed, updatedBy: actorId, updatedAt: new Date() },
      });
  }
  clearProviderCredentialsCache(provider);
}

export async function removeProviderCredentials(provider: ProviderName): Promise<void> {
  await db.delete(providerCredentials).where(eq(providerCredentials.provider, provider));
  clearProviderCredentialsCache(provider);
}

export interface ProviderMetadata {
  provider: ProviderName;
  configured: boolean;
  encryptionReady: boolean;
  previousKeyConfigured: boolean;
  source: "database" | "environment" | "none";
  fields: { name: string; stored: boolean; environment: boolean; updatedAt: string | null }[];
  lastTest: { status: string; message: string | null; createdAt: string } | null;
}

/** Metadata sans valeur secrète, destinée exclusivement au panneau admin. */
export async function providerMetadata(provider: ProviderName): Promise<ProviderMetadata> {
  const storedRows = await db
    .select({ name: providerCredentials.name, updatedAt: providerCredentials.updatedAt })
    .from(providerCredentials)
    .where(eq(providerCredentials.provider, provider));
  const stored = new Map(storedRows.map((row) => [row.name, row.updatedAt]));
  const [lastTest] = await db.select({ status: providerTestLogs.status, message: providerTestLogs.message, createdAt: providerTestLogs.createdAt }).from(providerTestLogs).where(eq(providerTestLogs.provider, provider)).orderBy(desc(providerTestLogs.createdAt)).limit(1);
  const env = envValues(provider);
  const fields = PROVIDER_FIELDS[provider].map((name) => ({
    name,
    stored: stored.has(name),
    environment: Boolean(env[name]),
    updatedAt: stored.get(name)?.toISOString() ?? null,
  }));
  const encryptionReady = Boolean(masterKey());
  const previousKeyConfigured = Boolean(previousMasterKey());
  const configured = REQUIRED_FIELDS[provider].every((name) =>
    (encryptionReady && stored.has(name)) || Boolean(env[name]),
  );
  return {
    provider,
    configured,
    encryptionReady,
    previousKeyConfigured,
    source: encryptionReady && stored.size ? "database" : configured ? "environment" : "none",
    fields,
    lastTest: lastTest ? { status: lastTest.status, message: lastTest.message, createdAt: lastTest.createdAt.toISOString() } : null,
  };
}

/**
 * Réchiffre chaque override DB avec la clé primaire. La procédure est
 * intentionnellement opérée par l’infrastructure : nouvelle clé dans
 * CREDENTIALS_ENCRYPTION_KEY, ancienne dans *_PREVIOUS, puis appel admin.
 */
export async function rotateProviderCredentialEncryption(): Promise<{ reencrypted: number }> {
  const current = masterKey();
  const previous = previousMasterKey();
  if (!current || !previous) {
    throw new ProviderCredentialsError("La rotation exige CREDENTIALS_ENCRYPTION_KEY et CREDENTIALS_ENCRYPTION_KEY_PREVIOUS côté serveur");
  }
  const rows = await db.select().from(providerCredentials);
  // Déchiffrer tout avant toute écriture : une clé erronée ne produit aucun
  // coffre partiellement tourné.
  const replacements = rows.map((row) => ({
    provider: row.provider,
    name: row.name,
    sealed: encrypt(decryptWithKeyring(row, current, previous), current),
  }));
  await db.transaction(async (tx) => {
    for (const replacement of replacements) {
      await tx.update(providerCredentials)
        .set({ ...replacement.sealed, updatedAt: new Date() })
        .where(and(eq(providerCredentials.provider, replacement.provider), eq(providerCredentials.name, replacement.name)));
    }
  });
  clearProviderCredentialsCache();
  return { reencrypted: replacements.length };
}

export async function allProviderMetadata(): Promise<ProviderMetadata[]> {
  return Promise.all(PROVIDERS.map((provider) => providerMetadata(provider)));
}

export function isKnownProvider(value: string): value is ProviderName {
  return (PROVIDERS as readonly string[]).includes(value);
}

/** Export de test : ne lit ni n'expose aucune clé persistée. */
export const __providerCredentialsTesting = { encrypt, decrypt };
