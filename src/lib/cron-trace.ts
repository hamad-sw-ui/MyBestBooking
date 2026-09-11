import { db } from "@/db";
import { cronRuns } from "@/db/schema";
import { desc, eq, lt, and, sql } from "drizzle-orm";

/**
 * T-250 (audit n°5, constat A7) — supervision des tâches planifiées.
 *
 * Constat : `GET /api/cron/price-alerts` renvoyait 14 compteurs, mais **rien**
 * ne les conservait ; `GET /api/health` n'exposait pas l'état des crons. Un
 * ordonnanceur muet (URL modifiée, `CRON_SECRET` absent, conteneur arrêté)
 * produisait donc un échec **silencieux** : plus de rappels de séjour, plus
 * d'alertes prix, sans qu'aucun écran ne le signale.
 *
 * Deux garanties :
 *  1. chaque exécution écrit une ligne `cron_runs` (succès comme échec) — la
 *     trace est **best-effort** : une panne de la table ne fait jamais échouer
 *     la tâche métier elle-même ;
 *  2. `getCronHealth()` calcule l'état par tâche (`ok` / `stale` / `missing`)
 *     à partir d'une cadence attendue déclarée.
 */

/**
 * Cadence attendue d'une tâche (sert au calcul de fraîcheur), en millisecondes.
 *
 * B1 (audit n°6) : la valeur doit refléter **l'ordonnanceur réel** — elle était
 * déclarée horaire alors que `vercel.json` planifie « 0 8 * * * » (quotidien),
 * ce qui affichait « En retard » ~21 h sur 24. `cron-schedule.test.ts` vérifie
 * désormais l'alignement entre ce registre et `vercel.json`.
 */
export const CRON_SCHEDULES: Record<string, number> = {
  "price-alerts": 24 * 60 * 60 * 1000, // quotidien 08:00 UTC (vercel.json : « 0 8 * * * »)
};

/** Tolérance avant de considérer une tâche en retard (3 périodes). */
const STALE_FACTOR = 3;

export interface CronRunResult<T> {
  value: T;
  /** Identifiant de la ligne écrite (null si la trace a échoué). */
  runId: string | null;
}

/**
 * Exécute `task` en traçant son résultat dans `cron_runs`.
 *
 * Le contrat du cron est **préservé** : la valeur retournée est celle de la
 * tâche (les compteurs de la réponse HTTP sont inchangés), et une tâche qui
 * lève propage son erreur après avoir écrit une ligne `ok = false`.
 */
export async function runWithTrace<T>(
  name: string,
  task: () => Promise<T>,
  countersOf: (value: T) => Record<string, number> = () => ({}),
): Promise<CronRunResult<T>> {
  const startedAt = new Date();
  try {
    const value = await task();
    const finishedAt = new Date();
    const runId = await recordCronRun({
      name,
      startedAt,
      finishedAt,
      ok: true,
      counters: countersOf(value),
      errorMessage: null,
    });
    return { value, runId };
  } catch (error) {
    const finishedAt = new Date();
    await recordCronRun({
      name,
      startedAt,
      finishedAt,
      ok: false,
      counters: null,
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    });
    throw error;
  }
}

async function recordCronRun(entry: {
  name: string;
  startedAt: Date;
  finishedAt: Date;
  ok: boolean;
  counters: Record<string, number> | null;
  errorMessage: string | null;
}): Promise<string | null> {
  try {
    const [row] = await db
      .insert(cronRuns)
      .values({
        name: entry.name,
        startedAt: entry.startedAt,
        finishedAt: entry.finishedAt,
        ok: entry.ok,
        durationMs: entry.finishedAt.getTime() - entry.startedAt.getTime(),
        counters: entry.counters,
        errorMessage: entry.errorMessage,
      })
      .returning({ id: cronRuns.id });
    return row?.id ?? null;
  } catch (error) {
    // Best-effort : la supervision ne doit jamais casser la tâche planifiée.
    console.error("[cron-trace] échec d'enregistrement", name, error);
    return null;
  }
}

export type CronStatus = "ok" | "stale" | "failed" | "missing";

/** Sévérité décroissante : l'état global est le plus grave rencontré. */
const SEVERITY: CronStatus[] = ["missing", "failed", "stale"];

export interface CronHealthEntry {
  name: string;
  status: CronStatus;
  lastRunAt: string | null;
  lastOk: boolean | null;
  ageMinutes: number | null;
  durationMs: number | null;
  counters: Record<string, number> | null;
  errorMessage: string | null;
  /** Cadence attendue (minutes). */
  expectedEveryMinutes: number;
}

export interface CronHealth {
  status: CronStatus;
  checkedAt: string;
  tasks: CronHealthEntry[];
}

/**
 * État global **sans lever** : la sonde `/api/health` ne doit pas échouer à
 * cause de l'indicateur de disponibilité. `"unknown"` signale simplement que
 * la supervision n'a pas pu être lue.
 */
export type CronHealthStatus = CronStatus | "unknown";

export interface CheckedCronHealth extends Omit<CronHealth, "status"> {
  status: CronHealthStatus;
}

export async function checkCronHealth(now: Date = new Date()): Promise<CheckedCronHealth> {
  try {
    return await getCronHealth(now);
  } catch (error) {
    console.error("[cron-trace] lecture de l'état impossible", error);
    return { status: "unknown", checkedAt: now.toISOString(), tasks: [] };
  }
}

/**
 * État de santé des tâches planifiées.
 *
 * `missing` : jamais exécutée ; `failed` : dernière exécution en erreur ;
 * `stale` : dernière exécution trop ancienne (3× la cadence) ; `ok` sinon.
 * L'état global est le **plus grave** des états individuels.
 */
export async function getCronHealth(now: Date = new Date()): Promise<CronHealth> {
  const names = Object.keys(CRON_SCHEDULES);
  const tasks: CronHealthEntry[] = [];

  for (const name of names) {
    const expected = CRON_SCHEDULES[name]!;
    const [last] = await db
      .select()
      .from(cronRuns)
      .where(eq(cronRuns.name, name))
      .orderBy(desc(cronRuns.startedAt))
      .limit(1);

    if (!last) {
      tasks.push({
        name,
        status: "missing",
        lastRunAt: null,
        lastOk: null,
        ageMinutes: null,
        durationMs: null,
        counters: null,
        errorMessage: null,
        expectedEveryMinutes: Math.round(expected / 60_000),
      });
      continue;
    }

    const lastRunAt = last.startedAt instanceof Date ? last.startedAt : new Date(last.startedAt);
    const ageMs = now.getTime() - lastRunAt.getTime();
    const status: CronStatus = !last.ok ? "failed" : ageMs > expected * STALE_FACTOR ? "stale" : "ok";
    tasks.push({
      name,
      status,
      lastRunAt: lastRunAt.toISOString(),
      lastOk: last.ok,
      ageMinutes: Math.round(ageMs / 60_000),
      durationMs: last.durationMs,
      counters: (last.counters as Record<string, number> | null) ?? null,
      errorMessage: last.errorMessage,
      expectedEveryMinutes: Math.round(expected / 60_000),
    });
  }

  const status = SEVERITY.find((s) => tasks.some((task) => task.status === s)) ?? "ok";
  return { status, checkedAt: now.toISOString(), tasks };
}

/** Dernières exécutions (toutes tâches confondues) pour l'écran d'admin. */
export async function listCronRuns(limit = 50) {
  return db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(limit);
}

/** Rétention des traces d'exécution (alignée sur `email_outbox`). */
export const CRON_RUN_RETENTION_DAYS = 90;

/** Rétention : supprime les traces de plus de `days` jours (best-effort). */
export async function purgeCronRuns(days = CRON_RUN_RETENTION_DAYS, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const removed = await db
    .delete(cronRuns)
    .where(and(lt(cronRuns.startedAt, cutoff), sql`${cronRuns.name} IS NOT NULL`))
    .returning({ id: cronRuns.id });
  return removed.length;
}
