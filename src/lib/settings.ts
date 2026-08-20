/**
 * T-021 (ADR-007) — Réglages runtime éditables par un admin sans
 * redéploiement.
 *
 * Le module expose un tri d'accès :
 *   getSetting(key)     — lit une section, retombe sur DEFAULTS si absent
 *   setSetting(...)     — écrit après validation Zod stricte
 *   clearSettingsCache  — utilitaire de test
 *
 * Sécurité et non-régression :
 *   - Les DEFAULTS reproduisent EXACTEMENT le comportement actuel (0.10 TVA,
 *     seuils BestRewards [5, 15], grille d'annulation identique).
 *   - Un cache mémoire de 60 s évite un round-trip par requête. L'écriture
 *     invalide le cache immédiatement dans le process courant.
 *   - Zod refuse toute valeur hors bornes. Les callers n'ont jamais à
 *     valider eux-mêmes.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

// ─── Clés autorisées ─────────────────────────────────────────────
export const SETTING_KEYS = [
  "general",
  "billing",
  "bestrewards",
  "cancellation",
  "notifications",
  "security",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

// ─── Schémas Zod par clé ─────────────────────────────────────────
export const generalSchema = z.object({
  siteName: z.string().min(1).max(100),
  supportEmail: z.string().email(),
  partnersEmail: z.string().email(),
  defaultCurrency: z.enum(["EUR", "USD", "GBP", "XAF"]),
  defaultLanguage: z.enum(["fr", "en", "ar"]),
});

export const billingSchema = z.object({
  /** Taux de TVA appliqué au subtotal (0 → 1). */
  taxRate: z.number().min(0).max(1),
  /** Commission par défaut appliquée aux nouvelles propriétés (%). */
  defaultCommissionRate: z.number().min(0).max(100),
});

export const bestrewardsSchema = z.object({
  /** Seuils croissants [level2, level3] en nombre de réservations. */
  thresholds: z
    .tuple([z.number().int().min(1), z.number().int().min(1)])
    .refine((t) => t[0] < t[1], "seuils doivent être strictement croissants"),
  /** Réductions par niveau [%1, %2, %3]. */
  discounts: z.tuple([
    z.number().min(0).max(100),
    z.number().min(0).max(100),
    z.number().min(0).max(100),
  ]),
});

const bucketSchema = z.object({
  /** Frais 0-100 % appliqué quand `daysUntilCheckIn >= days`. */
  days: z.number().int().min(0),
  percent: z.number().min(0).max(100),
});

export const cancellationSchema = z.object({
  /**
   * Grille pour chaque politique : liste de buckets triés du plus lointain
   * au plus proche. Le dernier bucket (`days: 0`) capture le cas
   * « annulation le jour même ».
   */
  free: z.array(bucketSchema).min(1),
  flexible: z.array(bucketSchema).min(1),
  moderate: z.array(bucketSchema).min(1),
  strict: z.array(bucketSchema).min(1),
  non_refundable: z.array(bucketSchema).min(1),
});
export type CancellationGrid = z.infer<typeof cancellationSchema>;

export const notificationsSchema = z.object({
  welcomeEmail: z.boolean(),
  bookingConfirmation: z.boolean(),
  bookingReminderJ3: z.boolean(),
  bookingReminderJ1: z.boolean(),
  reviewRequest: z.boolean(),
  priceAlerts: z.boolean(),
  newsletter: z.boolean(),
});

export const securitySchema = z.object({
  minPasswordLength: z.number().int().min(6).max(64),
  sessionDays: z.number().int().min(1).max(90),
  twoFactorRequiredHosts: z.boolean(),
  maintenanceMode: z.boolean(),
});

export const settingSchemas = {
  general: generalSchema,
  billing: billingSchema,
  bestrewards: bestrewardsSchema,
  cancellation: cancellationSchema,
  notifications: notificationsSchema,
  security: securitySchema,
} as const satisfies Record<SettingKey, z.ZodTypeAny>;

export type SettingValue<K extends SettingKey> = z.infer<
  (typeof settingSchemas)[K]
>;

// ─── Valeurs par défaut (= comportement actuel) ──────────────────
export const DEFAULTS: { [K in SettingKey]: SettingValue<K> } = {
  general: {
    siteName: "MyBestBooking",
    supportEmail: "support@mybestbooking.com",
    partnersEmail: "partners@mybestbooking.com",
    defaultCurrency: "EUR",
    defaultLanguage: "fr",
  },
  billing: {
    taxRate: 0.1,
    defaultCommissionRate: 15,
  },
  bestrewards: {
    thresholds: [5, 15],
    discounts: [10, 15, 20],
  },
  cancellation: {
    // Reproduit exactement src/lib/cancellation.ts avant refactor.
    free: [{ days: 0, percent: 0 }],
    flexible: [
      { days: 1, percent: 0 },
      { days: 0, percent: 100 },
    ],
    moderate: [
      { days: 5, percent: 0 },
      { days: 1, percent: 50 },
      { days: 0, percent: 100 },
    ],
    strict: [
      { days: 30, percent: 0 },
      { days: 7, percent: 50 },
      { days: 0, percent: 100 },
    ],
    non_refundable: [{ days: 0, percent: 100 }],
  },
  notifications: {
    welcomeEmail: true,
    bookingConfirmation: true,
    bookingReminderJ3: true,
    bookingReminderJ1: true,
    reviewRequest: true,
    priceAlerts: true,
    newsletter: false,
  },
  security: {
    minPasswordLength: 8,
    sessionDays: 30,
    twoFactorRequiredHosts: false,
    maintenanceMode: false,
  },
};

// ─── Cache mémoire (par process) ─────────────────────────────────
type CacheEntry<K extends SettingKey> = {
  value: SettingValue<K>;
  expiresAt: number;
};
const cache = new Map<SettingKey, CacheEntry<SettingKey>>();
const TTL_MS = 60_000;

export function clearSettingsCache(): void {
  cache.clear();
}

// ─── API principale ──────────────────────────────────────────────
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<SettingValue<K>> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as SettingValue<K>;
  }

  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  const raw = rows[0]?.value;
  const parsed = raw
    ? mergeDefaults(key, raw)
    : DEFAULTS[key];

  cache.set(key, { value: parsed, expiresAt: Date.now() + TTL_MS });
  return parsed;
}

/**
 * Valide `raw` contre le schéma de `key`. En cas d'échec (ex : payload
 * legacy incomplet), retombe silencieusement sur DEFAULTS pour garantir
 * la disponibilité — un log d'avertissement est émis. Un opérateur peut
 * ainsi corriger via l'UI admin sans downtime.
 */
function mergeDefaults<K extends SettingKey>(
  key: K,
  raw: unknown,
): SettingValue<K> {
  const schema = settingSchemas[key] as unknown as z.ZodType<SettingValue<K>>;
  const merged = deepMerge(DEFAULTS[key], raw);
  const result = schema.safeParse(merged);
  if (!result.success) {
    console.warn(
      `[settings] payload invalide pour '${key}', fallback DEFAULTS`,
      result.error.issues[0]?.message,
    );
    return DEFAULTS[key];
  }
  return result.data;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge(a: unknown, b: unknown): unknown {
  if (!isPlainObject(a) || !isPlainObject(b)) return b ?? a;
  const out: Record<string, unknown> = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = deepMerge(a[k], b[k]);
  }
  return out;
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  updatedBy: string | null,
): Promise<SettingValue<K>> {
  const schema = settingSchemas[key] as unknown as z.ZodType<SettingValue<K>>;
  const parsed = schema.parse(value); // throw ZodError si invalide

  await db
    .insert(appSettings)
    .values({ key, value: parsed, updatedBy })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: parsed,
        updatedBy,
        updatedAt: new Date(),
      },
    });

  cache.set(key, {
    value: parsed,
    expiresAt: Date.now() + TTL_MS,
  });
  return parsed;
}

/**
 * Lit toutes les sections en une fois pour l'UI /dashboard/settings.
 * Retourne les DEFAULTS pour les clés absentes.
 */
export async function getAllSettings(): Promise<{
  [K in SettingKey]: SettingValue<K>;
}> {
  const rows = await db.select().from(appSettings);
  const byKey = new Map(rows.map((r) => [r.key as SettingKey, r.value]));

  const result: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    const raw = byKey.get(key);
    result[key] = raw ? mergeDefaults(key, raw) : DEFAULTS[key];
  }
  return result as { [K in SettingKey]: SettingValue<K> };
}

/**
 * État des providers externes — dérivé exclusivement des env vars.
 * Ne retourne JAMAIS les valeurs des clés (uniquement configured?).
 */
export function getProviderStatus(): {
  stripe: boolean;
  resend: boolean;
  s3: boolean;
} {
  return {
    stripe: Boolean(
      process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET,
    ),
    resend: Boolean(process.env.RESEND_API_KEY),
    s3: Boolean(
      process.env.S3_ENDPOINT &&
        process.env.S3_BUCKET &&
        process.env.S3_ACCESS_KEY &&
        process.env.S3_SECRET_KEY,
    ),
  };
}
