import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CRON_SCHEDULES } from "@/lib/cron-trace";

/**
 * B1/B2 (audit n°6) — la supervision doit refléter **l'ordonnanceur réel**.
 *
 * Constat d'exécution : `CRON_SCHEDULES` déclarait `price-alerts` *horaire*
 * (« 0 * * * * » cité en commentaire) alors que `vercel.json` planifie
 * « 0 8 * * * » (quotidien) ; `/dashboard/cron` et `/api/health` annonçaient
 * donc « En retard » ≈ 21 h sur 24 (mesuré : trace de −4 h → `stale`).
 * Deuxième constat : `/api/cron/payouts` était planifié sans entrée de cadence
 * — invisible dans la supervision, et en 410 quotidien tant que les versements
 * plateforme sont désactivés (`platform-flags`), donc retiré de `vercel.json`.
 *
 * Ce test interdit la dérive dans les deux sens : toute tâche planifiée doit
 * avoir sa cadence déclarée, et toute cadence déclarée doit être planifiée.
 */

function cronIntervalMs(expression: string): number | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") return null;
  if (hour !== "*") return 24 * 60 * 60 * 1000;
  const step = /^\*\/(\d+)$/.exec(minute);
  if (step) return Number(step[1]) * 60 * 1000;
  if (/^\d+$/.test(minute)) return 60 * 60 * 1000;
  return null;
}

describe("B1/B2 — cadences déclarées alignées sur vercel.json", () => {
  const config = JSON.parse(
    readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
  ) as { crons?: Array<{ path: string; schedule: string }> };
  const crons = config.crons ?? [];

  it("chaque tâche planifiée déclare une cadence attendue identique à sa planification", () => {
    for (const cron of crons) {
      const name = cron.path.replace("/api/cron/", "");
      const declared = CRON_SCHEDULES[name];
      const interval = cronIntervalMs(cron.schedule);
      expect(interval, `cadence non modélisée pour ${cron.path} : ${cron.schedule}`).not.toBeNull();
      expect(declared, `aucune cadence déclarée pour ${cron.path}`).toBe(interval);
    }
  });

  it("aucune cadence déclarée sans tâche planifiée (pas d'entrée fantôme)", () => {
    const planned = new Set(crons.map((cron) => cron.path.replace("/api/cron/", "")));
    expect(Object.keys(CRON_SCHEDULES).filter((name) => !planned.has(name))).toEqual([]);
  });

  it("les versements plateforme restent désactivés : aucun cron payouts planifié", () => {
    // B2 : la route existe toujours (exécution manuelle par `scripts/cron-runner.mjs`),
    // mais elle répond 410 tant que `platformPayoutsEnabled()` est faux ; la
    // planifier produisait une exécution en erreur par jour, sans trace d'écran.
    expect(crons.some((cron) => cron.path.includes("payouts"))).toBe(false);
  });
});
