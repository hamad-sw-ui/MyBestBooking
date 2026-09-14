import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, types } from "pg";
import * as schema from "./schema";

/**
 * T-232 (audit n°3, F1/F10) — lecture normalisée des colonnes `date`.
 *
 * Par défaut, `node-postgres` convertit une colonne `date` en `Date` JS à
 * **minuit local du process** : `2026-09-24` devenait `2026-09-23T23:00:00Z`
 * sous `TZ=Africa/Douala`, si bien que les comparaisons métier (`toDate()`,
 * éligibilité d'un avis, clôture d'un séjour) dépendaient du fuseau de
 * l'instance. Drizzle déclare ces colonnes comme des chaînes : on rétablit la
 * valeur brute `YYYY-MM-DD` pour que le type TypeScript soit la vérité.
 */
types.setTypeParser(1082, (value: string) => value);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    // PERF-004 — durcissement des défauts `pg` (sinon : max 10 connexions,
    // aucune borne de temps). Une requête lente qui bloque un worker ne doit
    // pas figer indéfiniment une connexion du pool.
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
    // Une connexion restée inactive > 10 s peut avoir été coupée en amont
    // (proxy/NAT) : la revalider évite un « connection terminated » au pire
    // moment.
    keepAlive: true,
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 10_000),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool, { schema });
