"use client";

import { useT, useUiLocale } from "@/components/ui-locale-provider";
import { useMemo, useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText, Search, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toAuditEntryRow, type AuditEntryRow } from "@/lib/audit-rows";

/**
 * <AuditFilter> (T-034) — filtres client pour /dashboard/audit :
 *   - Recherche libre (acteur email, action, entityId, metadata JSON)
 *   - Filtre action (setting.update, review.moderate, user.suspend, bulk.action…)
 *   - Filtre entityType (users, properties, reviews, bookings, rooms, promotions, settings)
 *   - Raccourci `/` pour focus recherche
 */

export type { AuditEntryRow } from "@/lib/audit-rows";

type ActionInfo = { label: string; variant: "success" | "warning" | "info" | "danger" | "default" };

interface Props {
  entries: AuditEntryRow[];
  /** Nombre d'entrées chargées par le serveur (= pas de pagination API). */
  pageSize: number;
}

export function AuditFilter({ entries, pageSize }: Props) {
  const t = useT();
  const locale = useUiLocale();
  const ACTION_LABELS: Record<string, ActionInfo> = {
    "setting.update": { label: t("bulk.actionSetting"), variant: "info" },
    "review.moderate": { label: t("bulk.actionReview"), variant: "warning" },
    "user.suspend": { label: t("bulk.suspend"), variant: "danger" },
    "user.reactivate": { label: t("bulk.actionReactivate"), variant: "success" },
    "property.validate": { label: t("bulk.actionValidate"), variant: "success" },
    "property.reject": { label: t("bulk.actionReject"), variant: "warning" },
    "property.suspend": { label: t("bulk.suspend"), variant: "danger" },
    "bulk.action": { label: t("bulk.actionBulk"), variant: "info" },
    // T-215 / T-216 — commission hôte, commission hébergement, statut booking.
    "host.commission.update": { label: t("bulk.actionHostCommission"), variant: "warning" },
    "property.commission.update": { label: t("bulk.actionPropertyCommission"), variant: "warning" },
    "booking.status.update": { label: t("bulk.actionBookingStatus"), variant: "info" },
  };
  // T-217/P9 : la première page vient du serveur (rendu initial inchangé) ;
  // « charger plus » interroge `GET /api/admin/audit` (limit/offset) — l'API
  // paginée existait mais n'avait aucun appelant applicatif.
  const [extra, setExtra] = useState<AuditEntryRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(entries.length < pageSize);
  const rows = useMemo(() => [...entries, ...extra], [entries, extra]);
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);

  async function loadMore() {
    if (loadingMore || exhausted) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/admin/audit?limit=${pageSize}&offset=${rows.length}`,
        { cache: "no-store" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        entries?: Parameters<typeof toAuditEntryRow>[0][];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? t("settings.error"));
      const fetched = (body.entries ?? []).map(toAuditEntryRow);
      setExtra((prev) => [...prev, ...fetched]);
      if (fetched.length < pageSize) setExhausted(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("settings.error"));
    }
    setLoadingMore(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (e.key === "/" && !inField) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        if (document.activeElement === searchRef.current) {
          searchRef.current?.blur();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const actions = useMemo(
    () => Array.from(new Set(rows.map((e) => e.action))).sort(),
    [rows],
  );
  const entities = useMemo(
    () =>
      Array.from(
        new Set(entries.map((e) => e.entityType).filter((v): v is string => !!v)),
      ).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (entityFilter !== "all" && (e.entityType ?? "") !== entityFilter)
        return false;
      if (!ql) return true;
      const meta = e.metadata ? JSON.stringify(e.metadata).toLowerCase() : "";
      return (
        (e.actorEmail ?? "").toLowerCase().includes(ql) ||
        e.action.toLowerCase().includes(ql) ||
        (e.entityType ?? "").toLowerCase().includes(ql) ||
        (e.entityId ?? "").toLowerCase().includes(ql) ||
        meta.includes(ql)
      );
    });
  }, [rows, q, actionFilter, entityFilter]);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {t("dash.audit")}
        </h1>
        <p className="text-gray-600 mt-1">
{t("bulk.auditIntro")}
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
{t("bulk.search")} <span className="text-gray-400">{t("bulk.searchHint")}</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("bulk.searchAudit")}
              className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label={t("bulk.clearSearch")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("bulk.action")}
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none bg-white"
          >
            <option value="all">{t("bulk.allActions")}</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]?.label ?? a}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t("bulk.colEntity")}
          </label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none bg-white"
          >
            <option value="all">{t("bulk.allEntities")}</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-3">
{(filtered.length > 1 ? t("bulk.entriesShownMany") : t("bulk.entriesShown")).replace("{n}", String(filtered.length))}
        {filtered.length !== rows.length && ` ${t("bulk.ofTotal").replace("{n}", String(rows.length))}`}
      </p>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="w-8 h-8" />}
            title={t("bulk.noEntriesTitle")}
            description={t("bulk.noEntriesDesc")}
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-4 font-medium">{t("bulk.colDate")}</th>
                  <th className="px-6 py-4 font-medium">{t("bulk.colActor")}</th>
                  <th className="px-6 py-4 font-medium">{t("bulk.action")}</th>
                  <th className="px-6 py-4 font-medium">{t("bulk.colEntity")}</th>
                  <th className="px-6 py-4 font-medium">{t("bulk.colDetails")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const info =
                    ACTION_LABELS[e.action] ??
                    { label: e.action, variant: "default" as const };
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-gray-50 hover:bg-gray-50 align-top"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(e.createdAt, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }, locale)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {e.actorEmail ?? (
                          <span className="text-gray-400 italic">{t("bulk.system")}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={info.variant}>{info.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {e.entityType && (
                          <>
                            <span className="text-xs uppercase tracking-wide text-gray-400">
                              {e.entityType}
                            </span>
                            {e.entityId && (
                              <>
                                <br />
                                <code className="text-xs">{e.entityId}</code>
                              </>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 max-w-md">
                        {e.metadata ? (
                          <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-tight">
                            {JSON.stringify(e.metadata, null, 2)}
                          </pre>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* T-217/P9 : au-delà de la première page, chargement à la demande
          (même endpoint paginé que la supervision, aucun rechargement). */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
        <p className="text-sm text-gray-500">
          {t("bulk.auditLoaded").replace("{n}", String(rows.length))}
          {filtered.length !== rows.length && ` · ${t("bulk.auditFiltered").replace("{n}", String(filtered.length))}`}
        </p>
        {exhausted ? (
          <span className="text-xs text-gray-400">{t("bulk.auditAllLoaded")}</span>
        ) : (
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? t("bulk.loadingMore") : t("bulk.loadMore")}
          </Button>
        )}
        {loadError && <span className="text-xs text-red-600">{loadError}</span>}
      </div>

      <p className="text-xs text-gray-400 mt-3">
{t("bulk.shortcuts")} <kbd className="px-1 bg-gray-100 rounded">/</kbd> {t("bulk.shortcutSearch")} ·{" "}
        <kbd className="px-1 bg-gray-100 rounded">Esc</kbd> {t("bulk.shortcutLeave")}
      </p>
    </div>
  );
}
