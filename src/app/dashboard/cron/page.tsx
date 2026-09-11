import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { getCronHealth, listCronRuns } from "@/lib/cron-trace";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShowMore } from "@/components/ui/show-more";
import { parsePageWindow } from "@/lib/page-window";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, "success" | "warning" | "danger" | "default"> = {
  ok: "success",
  stale: "warning",
  failed: "danger",
  missing: "warning",
  unknown: "default",
};

/**
 * T-250 (audit n°5, constat A7) — écran de supervision des tâches planifiées.
 *
 * Constat : rien ne permettait de savoir si le cron s'exécutait. Cet écran monte
 * l'état calculé par `getCronHealth()` (dernière exécution, âge, durée,
 * compteurs, erreur) et l'historique des exécutions. Lecture seule : aucune
 * action ici ne modifie l'ordonnancement.
 */
export default async function CronHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }
  const t = makeT(await getServerLocale());
  const window = parsePageWindow((await searchParams).limit);
  const [health, runs] = await Promise.all([
    getCronHealth(),
    listCronRuns(window.queryLimit),
  ]);
  const visibleRuns = runs.slice(0, window.size);

  const dateFmt = { dateStyle: "medium", timeStyle: "short" } as const;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {t("dash.cron")}
        </h1>
        <p className="text-gray-600 mt-1">{t("dash.cronSub")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6" data-testid="cron-health">
        {health.tasks.map((task) => (
          <Card key={task.name}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{task.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {task.lastRunAt
                      ? t("cron.lastRun").replace("{date}", new Date(task.lastRunAt).toLocaleString(undefined, dateFmt))
                      : t("cron.never")}
                  </p>
                </div>
                <span data-testid={`cron-status-${task.name}`} data-status={task.status}>
                <Badge
                  variant={STATUS_TONES[task.status] ?? "default"}
                  className={
                    task.status === "ok"
                      ? "bg-green-100 text-green-800 border-green-200"
                      : task.status === "failed"
                        ? "bg-red-100 text-red-800 border-red-200"
                        : "bg-amber-100 text-amber-800 border-amber-200"
                  }
                >
                  {t(`cron.status.${task.status}`)}
                </Badge>
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">{t("cron.age")}</dt>
                  <dd className="font-medium text-gray-900">
                    {task.ageMinutes === null ? "—" : `${task.ageMinutes} min`}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t("cron.duration")}</dt>
                  <dd className="font-medium text-gray-900">
                    {task.durationMs === null ? "—" : `${task.durationMs} ms`}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500">{t("cron.cadence")}</dt>
                  <dd className="font-medium text-gray-900">
                    {t("cron.every").replace("{n}", String(task.expectedEveryMinutes))}
                  </dd>
                </div>
              </dl>

              {task.counters && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">{t("cron.counters")}</p>
                  <ul className="flex flex-wrap gap-2 text-xs">
                    {Object.entries(task.counters).map(([key, value]) => (
                      <li key={key} className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                        {key}: <span className="font-semibold">{String(value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {task.errorMessage && (
                <p role="alert" className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
                  {task.errorMessage}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">{t("cron.history")}</h2>
      {visibleRuns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500">
            {t("cron.noRuns")}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">{t("cron.colTask")}</th>
                <th className="px-4 py-2">{t("cron.colStarted")}</th>
                <th className="px-4 py-2">{t("cron.colDuration")}</th>
                <th className="px-4 py-2">{t("cron.colResult")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRuns.map((run) => {
                const started = run.startedAt instanceof Date ? run.startedAt : new Date(run.startedAt);
                return (
                  <tr key={run.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">{run.name}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {started.toLocaleString(undefined, dateFmt)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {run.durationMs === null ? "—" : `${run.durationMs} ms`}
                    </td>
                    <td className="px-4 py-2">
                      {run.ok ? (
                        <span className="text-green-700">{t("cron.runOk")}</span>
                      ) : (
                        <span className="text-red-700" title={run.errorMessage ?? undefined}>
                          {t("cron.runFailed")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ShowMore
        shown={visibleRuns.length}
        total={runs.length}
        hasMore={runs.length > visibleRuns.length}
        basePath="/dashboard/cron"
        params={{}}
        labels={{
          shown: t("list.window.shown"),
          showMore: t("list.window.showMore"),
          showAll: t("list.window.showAll"),
          limitReached: t("list.window.limitReached"),
          filterScope: t("list.window.filterScope"),
        }}
      />
    </div>
  );
}
