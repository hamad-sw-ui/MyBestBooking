"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { BulkToolbar, BulkIcons } from "./bulk-toolbar";
import { RowDeleteButton } from "./row-delete-button";
import { UserSuspendActions } from "@/components/admin/user-suspend-actions";

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

const roleLabels: Record<string, string> = {
  customer: "Client",
  host: "Hébergeur",
  admin: "Admin",
  moderator: "Modérateur",
  support: "Support",
};
const roleBadges: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800",
  host: "bg-green-100 text-green-800",
  admin: "bg-purple-100 text-purple-800",
  moderator: "bg-orange-100 text-orange-800",
  support: "bg-teal-100 text-teal-800",
};

function fmt(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
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
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "Clients", value: stats.customers, color: "text-blue-600" },
          { label: "Hébergeurs", value: stats.hosts, color: "text-green-600" },
          { label: "Admins", value: stats.admins, color: "text-purple-600" },
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
        searchPlaceholder="Nom, email, pays…"
        statusOptions={[
          { value: "all", label: "Tous les statuts" },
          { value: "active", label: "Actifs" },
          { value: "suspended", label: "Suspendus" },
          { value: "verified", label: "Email vérifié" },
          { value: "unverified", label: "Email non vérifié" },
        ]}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        actions={[
          {
            key: "suspend",
            label: "Suspendre",
            icon: BulkIcons.suspend,
            variant: "danger",
            confirmMessage: `Suspendre ${selected.size} utilisateur(s) ? Leurs sessions seront tuées.`,
          },
          {
            key: "reactivate",
            label: "Réactiver",
            icon: BulkIcons.reactivate,
            variant: "secondary",
          },
          {
            key: "anonymize",
            label: "Anonymiser (RGPD)",
            icon: BulkIcons.delete,
            variant: "danger",
            confirmMessage: `Anonymiser ${selected.size} utilisateur(s) ? L'email et le nom seront effacés (irréversible).`,
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
            {r === "all" ? "Tous les rôles" : roleLabels[r] ?? r}
          </button>
        ))}
      </div>

      {/* Résumé filtre */}
      <p className="text-sm text-gray-600 mb-3">
        {filtered.length} utilisateur{filtered.length > 1 ? "s" : ""} affiché
        {filtered.length > 1 ? "s" : ""}
        {filtered.length !== users.length && ` sur ${users.length}`}
        {selected.size > 0 && ` · ${selected.size} sélectionné(s)`}
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
                    aria-label="Sélectionner tous les utilisateurs visibles"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={selectable.length === 0}
                    className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
                  />
                </th>
                <th className="px-4 py-4 font-medium">Utilisateur</th>
                <th className="px-4 py-4 font-medium">Email</th>
                <th className="px-4 py-4 font-medium">Rôle</th>
                <th className="px-4 py-4 font-medium">BestRewards</th>
                <th className="px-4 py-4 font-medium">Inscrit</th>
                <th className="px-4 py-4 font-medium">Dernière conn.</th>
                <th className="px-4 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucun utilisateur ne correspond à vos filtres.
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
                        aria-label={`Sélectionner ${u.email}`}
                        checked={selected.has(u.id)}
                        onChange={() => toggle(u.id)}
                        disabled={!canSelect}
                        className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B] disabled:opacity-30"
                        title={!canSelect ? "Non sélectionnable (vous ou admin)" : undefined}
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
                            <p className="text-sm text-gray-500">{u.country}</p>
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
                          <Badge variant="bestrewards">💎 Level {u.bestrewardsLevel}</Badge>
                          <span className="text-xs text-gray-500">
                            {u.bestrewardsBookingsCount ?? 0} résa.
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {fmt(u.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {fmt(u.lastLoginAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {suspended && <Badge variant="danger">Suspendu</Badge>}
                        <UserSuspendActions
                          userId={u.id}
                          suspended={suspended}
                          disabled={isSelf}
                        />
                        <RowDeleteButton
                          entity="users"
                          id={u.id}
                          label={`l'utilisateur ${u.email}`}
                          disabled={isSelf || u.role === "admin"}
                        />
                        {isSelf && (
                          <span className="text-[10px] text-gray-400">(vous)</span>
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
        Raccourcis : <kbd className="px-1 bg-gray-100 rounded">/</kbd> chercher ·{" "}
        <kbd className="px-1 bg-gray-100 rounded">Ctrl+A</kbd> tout sélectionner ·{" "}
        <kbd className="px-1 bg-gray-100 rounded">Échap</kbd> vider
      </p>
    </div>
  );
}
