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
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool, { schema });
