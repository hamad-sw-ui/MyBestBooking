"use client";

import { useT } from "@/components/ui-locale-provider";
import { useMemo, useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText, Search, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

/**
 * <AuditFilter> (T-034) — filtres client pour /dashboard/audit :
 *   - Recherche libre (acteur email, action, entityId, metadata JSON)
 *   - Filtre action (setting.update, review.moderate, user.suspend, bulk.action…)
 *   - Filtre entityType (users, properties, reviews, bookings, rooms, promotions, settings)
 *   - Raccourci `/` pour focus recherche
 */

export interface AuditEntryRow {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

type ActionInfo = { label: string; variant: "success" | "warning" | "info" | "danger" | "default" };

interface Props {
  entries: AuditEntryRow[];
}

export function AuditFilter({ entries }: Props) {
  const t = useT();
  const ACTION_LABELS: Record<string, ActionInfo> = {
    "setting.update": { label: t("bulk.actionSetting"), variant: "info" },
    "review.moderate": { label: t("bulk.actionReview"), variant: "warning" },
    "user.suspend": { label: t("bulk.suspend"), variant: "danger" },
    "user.reactivate": { label: t("bulk.actionReactivate"), variant: "success" },
    "property.validate": { label: t("bulk.actionValidate"), variant: "success" },
    "property.reject": { label: t("bulk.actionReject"), variant: "warning" },
    "property.suspend": { label: t("bulk.suspend"), variant: "danger" },
    "bulk.action": { label: t("bulk.actionBulk"), variant: "info" },
  };
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);

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
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries],
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
    return entries.filter((e) => {
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
  }, [entries, q, actionFilter, entityFilter]);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Journal d&apos;audit
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
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Action
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none bg-white"
          >
            <option value="all">Toutes actions</option>
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
        {filtered.length > 1 ? "s" : ""}
        {filtered.length !== entries.length && ` sur ${entries.length}`}
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
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Acteur</th>
                  <th className="px-6 py-4 font-medium">Action</th>
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
                        })}
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

      <p className="text-xs text-gray-400 mt-3">
{t("bulk.shortcuts")} <kbd className="px-1 bg-gray-100 rounded">/</kbd> {t("bulk.shortcutSearch")} ·{" "}
        <kbd className="px-1 bg-gray-100 rounded">Esc</kbd> {t("bulk.shortcutLeave")}
      </p>
    </div>
  );
}
