import { db } from "@/db";
import { sql } from "drizzle-orm";
import { checkCronHealth } from "@/lib/cron-trace";

export const dynamic = "force-dynamic";

/**
 * T-250 (audit n°5, A7) : la sonde de santé expose désormais l'état des tâches
 * planifiées (`crons`), sans changer le contrat existant — `ok` reste `true`
 * tant que la base répond, et le code HTTP reste 200. Les champs `crons` /
 * `cronStatus` sont **additifs** : un ordonnanceur externe peu regardant continue
 * de fonctionner, un superviseur attentif voit un cron muet.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
  } catch {
    return Response.json({ ok: false, database: "down" }, { status: 500 });
  }

  // La supervision ne doit jamais faire échouer la sonde : une panne de
  // `cron_runs` (table absente avant migration) est signalée, pas propagée.
  try {
    const crons = await checkCronHealth();
    return Response.json({
      ok: true,
      database: "up",
      cronStatus: crons.status,
      crons: crons.tasks,
      checkedAt: crons.checkedAt,
    });
  } catch (error) {
    console.error("[health] lecture des crons impossible", error);
    return Response.json({
      ok: true,
      database: "up",
      cronStatus: "unknown",
      error: "cron health unavailable",
    });
  }
}
