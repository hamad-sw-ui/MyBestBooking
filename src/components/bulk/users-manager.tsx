"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { BulkToolbar, BulkIcons } from "./bulk-toolbar";
import { RowDeleteButton } from "./row-delete-button";
import { UserSuspendActions } from "@/components/admin/user-suspend-actions";
import { useT, useUiLocale } from "@/components/ui-locale-provider";
import { countryLabel } from "@/lib/country-label";

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  country: string | null;
  emailVerified: boolean | null;
  bestrewardsLevel: number | null;
  bestrewardsBookingsCount: number | null;
  createdAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
}


const roleBadges: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800",
  host: "bg-green-100 text-green-800",
  admin: "bg-purple-100 text-purple-800",
  moderator: "bg-orange-100 text-orange-800",
  support: "bg-teal-100 text-teal-800",
};

function fmt(d: string | null, locale: string): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

interface Props {
  users: UserRow[];
  currentUserId: string;
}

export function UsersManager({ users, currentUserId }: Props) {
  const t = useT();
  const locale = useUiLocale();
  const roleLabels: Record<string, string> = {
    customer: t("auth.roleCustomer"),
    host: t("auth.roleHost"),
    admin: t("auth.roleAdmin"),
    moderator: t("bulk.roleModerator"),
    support: t("bulk.roleSupport"),
  };
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && u.deletedAt) return false;
      if (statusFilter === "suspended" && !u.deletedAt) return false;
      if (statusFilter === "verified" && !u.emailVerified) return false;
      if (statusFilter === "unverified" && u.emailVerified) return false;
      if (!ql) return true;
      return (
        u.email.toLowerCase().includes(ql) ||
        u.firstName.toLowerCase().includes(ql) ||
        u.lastName.toLowerCase().includes(ql) ||
        (u.country ?? "").toLowerCase().includes(ql)
      );
    });
  }, [users, q, statusFilter, roleFilter]);

  const selectable = filtered.filter((u) => u.id !== currentUserId && u.role !== "admin");
  const allSelected =
    selectable.length > 0 && selectable.every((u) => selected.has(u.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected);
      for (const u of selectable) next.delete(u.id);
      setSelected(next);
    } else {
      const next = new Set(selected);
      for (const u of selectable) next.add(u.id);
      setSelected(next);
    }
  }

  const stats = {
    total: users.length,
    customers: users.filter((u) => u.role === "customer").length,
    hosts: users.filter((u) => u.role === "host").length,
    admins: users.filter((u) => u.role === "admin").length,
  };

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: t("bulk.total"), value: stats.total, color: "text-gray-900" },
          { label: t("bulk.customers"), value: stats.customers, color: "text-blue-600" },
          { label: t("bulk.hosts"), value: stats.hosts, color: "text-green-600" },
          { label: t("bulk.admins"), value: stats.admins, color: "text-purple-600" },
        ].map((s) => (
          <Card key={s.label} padding="sm">
            <div className="p-4">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar filtres + actions groupées */}
      <BulkToolbar
        entity="users"
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        onSelectAll={() => setSelected(new Set(selectable.map((u) => u.id)))}
        onDeselectAll={() => setSelected(new Set())}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder={t("bulk.searchUsers")}
        statusOptions={[
          { value: "all", label: t("bulk.allStatuses") },
          { value: "active", label: t("bulk.active") },
          { value: "suspended", label: t("bulk.suspended") },
          { value: "verified", label: t("bulk.emailVerified") },
          { value: "unverified", label: t("bulk.emailUnverified") },
        ]}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        actions={[
          {
            key: "suspend",
            label: t("bulk.suspend"),
            icon: BulkIcons.suspend,
            variant: "danger",
            confirmMessage: t("bulk.confirmSuspend").replace("{n}", String(selected.size)),
          },
          {
            key: "reactivate",
            label: t("bulk.reactivate"),
            icon: BulkIcons.reactivate,
            variant: "secondary",
          },
          {
            key: "anonymize",
            label: t("bulk.anonymize"),
            icon: BulkIcons.delete,
            variant: "danger",
            confirmMessage: t("bulk.confirmAnonymize").replace("{n}", String(selected.size)),
          },
        ]}
      />

      {/* Filtre role secondaire */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "customer", "host", "admin"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1 text-sm rounded-full border transition ${
              roleFilter === r
                ? "bg-[#1B3A6B] text-white border-[#1B3A6B]"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {r === "all" ? t("bulk.allRoles") : roleLabels[r] ?? r}
          </button>
        ))}
      </div>

      {/* Résumé filtre */}
      <p className="text-sm text-gray-600 mb-3">
        {(filtered.length > 1 ? t("bulk.usersShownMany") : t("bulk.usersShown")).replace("{n}", String(filtered.length))}
        {filtered.length !== users.length && ` ${t("bulk.ofTotal").replace("{n}", String(users.length))}`}
        {selected.size > 0 && t("bulk.selectedSuffix").replace("{n}", String(selected.size))}
      </p>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    aria-label={t("bulk.selectAllUsers")}
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={selectable.length === 0}
                    className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
                  />
                </th>
                <th className="px-4 py-4 font-medium">{t("bulk.colUser")}</th>
                <th className="px-4 py-4 font-medium">{t("bulk.colEmail")}</th>
                <th className="px-4 py-4 font-medium">{t("bulk.colRole")}</th>
                <th className="px-4 py-4 font-medium">BestRewards</th>
                <th className="px-4 py-4 font-medium">{t("bulk.colSignedUp")}</th>
                <th className="px-4 py-4 font-medium">{t("bulk.colLastLogin")}</th>
                <th className="px-4 py-4 font-medium text-right">{t("bulk.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    {t("bulk.noUsers")}
                  </td>
                </tr>
              )}
              {filtered.map((u) => {
                const suspended = Boolean(u.deletedAt);
                const isSelf = u.id === currentUserId;
                const canSelect = !isSelf && u.role !== "admin";
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${
                      suspended ? "opacity-60" : ""
                    } ${selected.has(u.id) ? "bg-blue-50/50" : ""}`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label={t("bulk.selectUser").replace("{email}", u.email)}
                        checked={selected.has(u.id)}
                        onChange={() => toggle(u.id)}
                        disabled={!canSelect}
                        className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B] disabled:opacity-30"
                        title={!canSelect ? t("bulk.notSelectable") : undefined}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white font-medium">
                          {u.firstName.charAt(0)}
                          {u.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {u.firstName} {u.lastName}
                          </p>
                          {u.country && (
                            <p className="text-sm text-gray-500">{countryLabel(u.country, t)}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm break-all">{u.email}</span>
                        {u.emailVerified && (
                          <span className="text-green-500 text-xs">✓</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={roleBadges[u.role] ?? "bg-gray-100 text-gray-800"}>
                        {roleLabels[u.role] ?? u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      {u.bestrewardsLevel && (
                        <div className="flex items-center gap-2">
                          <Badge variant="bestrewards">💎 {t("nav.level")} {u.bestrewardsLevel}</Badge>
                          <span className="text-xs text-gray-500">
                            {t("bulk.bookingsShort").replace("{n}", String(u.bestrewardsBookingsCount ?? 0))}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {fmt(u.createdAt, locale)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {fmt(u.lastLoginAt, locale)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {suspended && <Badge variant="danger">{t("bulk.suspendedBadge")}</Badge>}
                        <UserSuspendActions
                          userId={u.id}
                          suspended={suspended}
                          disabled={isSelf}
                        />
                        <RowDeleteButton
                          entity="users"
                          id={u.id}
                          label={t("bulk.userLabel").replace("{email}", u.email)}
                          disabled={isSelf || u.role === "admin"}
                        />
                        {isSelf && (
                          <span className="text-[10px] text-gray-400">{t("bulk.you")}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Aide raccourcis */}
      <p className="text-xs text-gray-400 mt-3">
        {t("bulk.shortcuts")} <kbd className="px-1 bg-gray-100 rounded">/</kbd> {t("bulk.shortcutSearch")} ·{" "}
        <kbd className="px-1 bg-gray-100 rounded">Ctrl+A</kbd> {t("bulk.shortcutSelectAll")} ·{" "}
        <kbd className="px-1 bg-gray-100 rounded">Esc</kbd> {t("bulk.shortcutClear")}
      </p>
    </div>
  );
}
