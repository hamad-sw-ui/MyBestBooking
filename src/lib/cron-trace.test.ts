import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

/**
 * T-250 (audit n°5, A7) — supervision des tâches planifiées.
 *
 * Contrats vérifiés :
 *  - `runWithTrace` enregistre une ligne (succès comme échec), retourne la
 *    valeur de la tâche et **propage** l'erreur de la tâche ;
 *  - `getCronHealth` distingue `missing` / `ok` / `failed` / `stale` selon la
 *    dernière exécution, et l'état global est le plus grave ;
 *  - `purgeCronRuns` ne supprime que les traces au-delà de la rétention.
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

dbTest("T-250 — traces et santé des crons", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let cronTrace: typeof import("@/lib/cron-trace");

  async function clearRuns() {
    const { eq } = await import("drizzle-orm");
    await db.delete(schema.cronRuns).where(eq(schema.cronRuns.name, "price-alerts"));
  }

  async function insertRun(overrides: {
    startedAt: Date;
    ok: boolean;
    counters?: Record<string, number> | null;
    errorMessage?: string | null;
  }) {
    const [row] = await db
      .insert(schema.cronRuns)
      .values({
        name: "price-alerts",
        startedAt: overrides.startedAt,
        finishedAt: overrides.startedAt,
        ok: overrides.ok,
        durationMs: 12,
        counters: overrides.counters ?? null,
        errorMessage: overrides.errorMessage ?? null,
      })
      .returning();
    return row;
  }

  beforeAll(async () => {
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    cronTrace = await import("@/lib/cron-trace");
  });

  beforeEach(async () => {
    await clearRuns();
  });

  afterAll(async () => {
    if (!db) return;
    await clearRuns();
  });

  it("runWithTrace : enregistre la valeur, les compteurs et retourne la tâche", async () => {
    const { value, runId } = await cronTrace.runWithTrace(
      "price-alerts",
      async () => ({ scanned: 4, notified: 2 }),
      (result) => ({ scanned: result.scanned, notified: result.notified }),
    );
    expect(value).toEqual({ scanned: 4, notified: 2 });
    expect(runId).toBeTruthy();

    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(schema.cronRuns)
      .where(eq(schema.cronRuns.id, runId as string));
    expect(row?.ok).toBe(true);
    expect(row?.counters).toEqual({ scanned: 4, notified: 2 });
    expect(row?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("runWithTrace : enregistre l'échec puis propage l'erreur", async () => {
    await expect(
      cronTrace.runWithTrace("price-alerts", async () => {
        throw new Error("base indisponible");
      }),
    ).rejects.toThrow("base indisponible");

    const { desc } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(schema.cronRuns)
      .orderBy(desc(schema.cronRuns.startedAt))
      .limit(1);
    expect(row?.ok).toBe(false);
    expect(row?.errorMessage).toBe("base indisponible");
  });

  it("getCronHealth : missing → ok → failed → stale", async () => {
    const now = new Date("2026-09-11T12:00:00.000Z");

    let health = await cronTrace.getCronHealth(now);
    expect(health.status).toBe("missing");
    expect(health.tasks[0]?.status).toBe("missing");

    await insertRun({ startedAt: new Date("2026-09-11T11:30:00.000Z"), ok: true });
    health = await cronTrace.getCronHealth(now);
    expect(health.tasks[0]?.status).toBe("ok");
    expect(health.tasks[0]?.ageMinutes).toBe(30);
    expect(health.status).toBe("ok");

    await clearRuns();
    await insertRun({ startedAt: new Date("2026-09-11T11:55:00.000Z"), ok: false, errorMessage: "boom" });
    health = await cronTrace.getCronHealth(now);
    expect(health.tasks[0]?.status).toBe("failed");
    expect(health.status).toBe("failed");
    expect(health.tasks[0]?.errorMessage).toBe("boom");

    await clearRuns();
    // 4 h (> 3 × cadence horaire) et dernière exécution réussie → en retard.
    await insertRun({ startedAt: new Date("2026-09-11T08:00:00.000Z"), ok: true });
    health = await cronTrace.getCronHealth(now);
    expect(health.tasks[0]?.status).toBe("stale");
    expect(health.status).toBe("stale");
  });

  it("checkCronHealth : ne lève jamais (état « unknown » si la lecture échoue)", async () => {
    const spy = vi
      .spyOn(schema.cronRuns, "name", "get")
      .mockImplementation(() => {
        throw new Error("lecture impossible");
      });
    const health = await cronTrace.checkCronHealth(new Date("2026-09-11T12:00:00.000Z"));
    spy.mockRestore();
    expect(health.status).toBe("unknown");
    expect(health.tasks).toEqual([]);
  });

  it("purgeCronRuns : supprime seulement au-delà de la rétention", async () => {
    const now = new Date("2026-09-11T12:00:00.000Z");
    const old = await insertRun({
      startedAt: new Date("2026-06-01T10:00:00.000Z"), // > 90 jours
      ok: true,
    });
    const recent = await insertRun({ startedAt: new Date("2026-09-10T10:00:00.000Z"), ok: true });

    const removed = await cronTrace.purgeCronRuns(90, now);
    expect(removed).toBe(1);

    const { inArray } = await import("drizzle-orm");
    const remaining = await db
      .select({ id: schema.cronRuns.id })
      .from(schema.cronRuns)
      .where(inArray(schema.cronRuns.id, [old!.id, recent!.id]));
    expect(remaining.map((row) => row.id)).toEqual([recent!.id]);
  });
});
