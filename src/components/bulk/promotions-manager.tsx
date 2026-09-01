"use client";

import { useT, useUiLocale } from "@/components/ui-locale-provider";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, formatDate } from "@/lib/utils";
import { Tag, Plus, Percent, Copy } from "lucide-react";
import { BulkToolbar, BulkIcons } from "./bulk-toolbar";
import { RowDeleteButton } from "./row-delete-button";

/**
 * <PromotionsManager> (T-034) — dashboard `/dashboard/promotions` admin.
 *   - Recherche client (code, nom)
 *   - Filtre statut (active/inactive/expirée)
 *   - Filtre type (percentage/fixed/free_night)
 *   - Sélection multiple + bulk activate/deactivate/delete
 *   - Icône corbeille par ligne (refuse si currentUses > 0)
 */

export interface PromoRow {
  id: string;
  code: string;
  name: string;
  type: string;
  value: string;
  minBookingAmount: string | null;
  maxDiscount: string | null;
  validFrom: string;
  validUntil: string;
  maxUses: number | null;
  currentUses: number | null;
  isActive: boolean | null;
  createdAt: string;
}

interface Props {
  promotions: PromoRow[];
}

export function PromotionsManager({ promotions }: Props) {
  const t = useT();
  const locale = useUiLocale();
  const typeLabels: Record<string, string> = {
    percentage: t("bulk.percentage"),
    fixed_amount: t("bulk.fixedAmount"),
    free_night: t("bulk.freeNight"),
  };
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const now = new Date();
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return promotions.filter((p) => {
      const expired = new Date(p.validUntil) <= now;
      const active = p.isActive && !expired;
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && (p.isActive || expired)) return false;
      if (statusFilter === "expired" && !expired) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (!ql) return true;
      return (
        p.code.toLowerCase().includes(ql) ||
        p.name.toLowerCase().includes(ql)
      );
    });
  }, [promotions, q, statusFilter, typeFilter, now]);

  const allSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected);
      for (const p of filtered) next.delete(p.id);
      setSelected(next);
    } else {
      const next = new Set(selected);
      for (const p of filtered) next.add(p.id);
      setSelected(next);
    }
  }

  const stats = {
    total: promotions.length,
    active: promotions.filter(
      (p) => p.isActive && new Date(p.validUntil) > now,
    ).length,
    uses: promotions.reduce((s, p) => s + (p.currentUses ?? 0), 0),
    expired: promotions.filter((p) => new Date(p.validUntil) <= now).length,
  };

  const bulkActions = [
    {
      key: "activate",
      label: t("bulk.activate"),
      icon: BulkIcons.approve,
      variant: "primary" as const,
    },
    {
      key: "deactivate",
      label: t("bulk.deactivate"),
      icon: BulkIcons.hide,
      variant: "secondary" as const,
    },
    {
      key: "delete",
      label: t("bulk.delete"),
      icon: BulkIcons.delete,
      variant: "danger" as const,
      confirmMessage: t("bulk.confirmDeletePromos").replace("{n}", String(selected.size)),
    },
  ];

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {t("dash.promotions")}
          </h1>
          <p className="text-gray-600 mt-1">
{t("bulk.managePromos")}
          </p>
        </div>
        <Link href="/dashboard/promotions/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {t("bulk.newPromo")}
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: t("bulk.total"), value: stats.total, color: "text-gray-900" },
          { label: t("bulk.activeFeminine"), value: stats.active, color: "text-green-600" },
          { label: t("bulk.uses"), value: stats.uses, color: "text-blue-600" },
          { label: t("bulk.expiredMany"), value: stats.expired, color: "text-gray-400" },
        ].map((s) => (
          <Card key={s.label} padding="sm">
            <div className="p-4">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <BulkToolbar
        entity="promotions"
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        onSelectAll={() => setSelected(new Set(filtered.map((p) => p.id)))}
        onDeselectAll={() => setSelected(new Set())}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder={t("bulk.searchPromos")}
        statusOptions={[
          { value: "all", label: t("bulk.allStatusesShort") },
          { value: "active", label: t("bulk.activeFeminine") },
          { value: "inactive", label: t("bulk.inactiveFeminine") },
          { value: "expired", label: t("bulk.expiredMany") },
        ]}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        actions={bulkActions}
      />

      {/* Filtre type secondaire */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "percentage", "fixed_amount", "free_night"].map((ty) => (
          <button
            key={ty}
            type="button"
            onClick={() => setTypeFilter(ty)}
            className={`px-3 py-1 text-sm rounded-full border transition ${
              typeFilter === ty
                ? "bg-[#1B3A6B] text-white border-[#1B3A6B]"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {ty === "all" ? t("bulk.allTypes") : typeLabels[ty] ?? ty}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-600 mb-3">
        {(filtered.length > 1 ? t("bulk.promosShownMany") : t("bulk.promosShown")).replace("{n}", String(filtered.length))}
        {filtered.length !== promotions.length && ` ${t("bulk.ofTotal").replace("{n}", String(promotions.length))}`}
        {selected.size > 0 && t("bulk.selectedSuffix").replace("{n}", String(selected.size))}
      </p>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Tag className="w-8 h-8" />}
            title={t("bulk.noPromosTitle")}
            description={t("bulk.noPromosDesc")}
            action={
              <Link href="/dashboard/promotions/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
{t("bulk.createPromo")}
                </Button>
              </Link>
            }
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      aria-label={t("bulk.selectAllPromos")}
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
                    />
                  </th>
                  <th className="px-4 py-4 font-medium">{t("bulk.colCode")}</th>
                  <th className="px-4 py-4 font-medium">{t("bulk.colName")}</th>
                  <th className="px-4 py-4 font-medium">{t("bulk.colType")}</th>
                  <th className="px-4 py-4 font-medium">{t("bulk.colValue")}</th>
                  <th className="px-4 py-4 font-medium">{t("bulk.colValidity")}</th>
                  <th className="px-4 py-4 font-medium">{t("bulk.colUses")}</th>
                  <th className="px-4 py-4 font-medium">{t("dash.colStatus")}</th>
                  <th className="px-4 py-4 font-medium text-right">{t("bulk.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((promo) => {
                  const isExpired = new Date(promo.validUntil) <= now;
                  const isActive = promo.isActive && !isExpired;
                  const usagePercent = promo.maxUses
                    ? ((promo.currentUses ?? 0) / promo.maxUses) * 100
                    : 0;
                  return (
                    <tr
                      key={promo.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${
                        selected.has(promo.id) ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={t("bulk.selectNamed").replace("{name}", promo.code)}
                          checked={selected.has(promo.id)}
                          onChange={() => toggle(promo.id)}
                          className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono font-medium">
                            {promo.code}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyCode(promo.code)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title={t("bulk.copy")}
                            aria-label={t("bulk.copyNamed").replace("{code}", promo.code)}
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{promo.name}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {promo.type === "percentage" ? (
                            <Percent className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Tag className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-sm">
                            {typeLabels[promo.type] ?? promo.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-[#FF5A5F]">
                          {promo.type === "percentage"
                            ? `-${promo.value}%`
                            : promo.type === "fixed_amount"
                            ? `-${formatPrice(promo.value, "EUR", locale)}`
                            : t("bulk.oneNightFree")}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {formatDate(promo.validFrom, {
                              day: "numeric",
                              month: "short",
                            }, locale)}
                          </p>
                          <p className="text-gray-500">
                            →{" "}
                            {formatDate(promo.validUntil, {
                              day: "numeric",
                              month: "short",
                            }, locale)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm font-medium">
                            {promo.currentUses ?? 0}
                            {promo.maxUses && ` / ${promo.maxUses}`}
                          </p>
                          {promo.maxUses && (
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                              <div
                                className="h-full bg-[#1B3A6B] rounded-full"
                                style={{
                                  width: `${Math.min(usagePercent, 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {isExpired ? (
                          <Badge variant="default">{t("bulk.expired")}</Badge>
                        ) : isActive ? (
                          <Badge variant="success">{t("bulk.activeFeminineSingular")}</Badge>
                        ) : (
                          <Badge variant="warning">{t("bulk.inactiveBadge")}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <RowDeleteButton
                            entity="promotions"
                            id={promo.id}
                            label={t("bulk.promoLabel").replace("{code}", promo.code)}
                          />
                        </div>
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
        <kbd className="px-1 bg-gray-100 rounded">Ctrl+A</kbd> {t("bulk.shortcutSelectAll")} ·{" "}
        <kbd className="px-1 bg-gray-100 rounded">Esc</kbd> {t("bulk.shortcutClear")}
      </p>
    </div>
  );
}
