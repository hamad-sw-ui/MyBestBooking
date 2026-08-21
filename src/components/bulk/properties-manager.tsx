"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getPropertyTypeLabel, getStatusBadgeColor } from "@/lib/utils";
import { Building2, MapPin, Star, Pencil, Eye } from "lucide-react";
import { BulkToolbar, BulkIcons } from "./bulk-toolbar";
import { PropertyValidateActions } from "@/components/property-validate-actions";

export interface PropertyRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string | null;
  city: string;
  country: string;
  starRating: number | null;
  averageRating: string | null;
  totalReviews: number | null;
  mainImage: string | null;
  hostId?: string | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  active: "Actif",
  pending: "En attente",
  draft: "Brouillon",
  suspended: "Suspendu",
  archived: "Archivé",
  rejected: "Rejeté",
};

interface Props {
  properties: PropertyRow[];
  isAdmin: boolean;
}

export function PropertiesManager({ properties, isAdmin }: Props) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const types = useMemo(
    () => Array.from(new Set(properties.map((p) => p.type))).sort(),
    [properties],
  );

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return properties.filter((p) => {
      if (statusFilter !== "all" && (p.status ?? "pending") !== statusFilter)
        return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (!ql) return true;
      return (
        p.name.toLowerCase().includes(ql) ||
        p.city.toLowerCase().includes(ql) ||
        p.country.toLowerCase().includes(ql) ||
        p.slug.toLowerCase().includes(ql)
      );
    });
  }, [properties, q, statusFilter, typeFilter]);

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
    total: properties.length,
    active: properties.filter((p) => p.status === "active").length,
    pending: properties.filter((p) => (p.status ?? "pending") === "pending").length,
    draft: properties.filter((p) => p.status === "draft").length,
  };

  const bulkActions = isAdmin
    ? [
        {
          key: "approve",
          label: "Approuver",
          icon: BulkIcons.approve,
          variant: "primary" as const,
          confirmMessage: `Approuver ${selected.size} hébergement(s) ? Ils seront visibles publiquement.`,
        },
        {
          key: "reject",
          label: "Rejeter",
          icon: BulkIcons.reject,
          variant: "secondary" as const,
          confirmMessage: `Rejeter ${selected.size} hébergement(s) ? Ils repasseront en brouillon.`,
        },
        {
          key: "suspend",
          label: "Suspendre",
          icon: BulkIcons.suspend,
          variant: "danger" as const,
          confirmMessage: `Suspendre ${selected.size} hébergement(s) ?`,
        },
      ]
    : [];

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "Actifs", value: stats.active, color: "text-green-600" },
          { label: "En attente", value: stats.pending, color: "text-orange-600" },
          { label: "Brouillons", value: stats.draft, color: "text-gray-500" },
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
        entity="properties"
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        onSelectAll={() => setSelected(new Set(filtered.map((p) => p.id)))}
        onDeselectAll={() => setSelected(new Set())}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Nom, ville, pays, slug…"
        statusOptions={[
          { value: "all", label: "Tous les statuts" },
          { value: "active", label: "Actif" },
          { value: "pending", label: "En attente" },
          { value: "draft", label: "Brouillon" },
          { value: "suspended", label: "Suspendu" },
          { value: "rejected", label: "Rejeté" },
        ]}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        actions={bulkActions}
      />

      {/* Filtre type secondaire */}
      {types.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`px-3 py-1 text-sm rounded-full border transition ${
              typeFilter === "all"
                ? "bg-[#1B3A6B] text-white border-[#1B3A6B]"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            Tous types
          </button>
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 text-sm rounded-full border transition ${
                typeFilter === t
                  ? "bg-[#1B3A6B] text-white border-[#1B3A6B]"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {getPropertyTypeLabel(t)}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-600 mb-3">
        {filtered.length} hébergement{filtered.length > 1 ? "s" : ""} affiché
        {filtered.length > 1 ? "s" : ""}
        {filtered.length !== properties.length && ` sur ${properties.length}`}
        {selected.size > 0 && ` · ${selected.size} sélectionné(s)`}
      </p>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-12 h-12 text-gray-300" />}
            title="Aucun hébergement"
            description="Aucun hébergement ne correspond à vos filtres."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  {isAdmin && (
                    <th className="px-4 py-4 w-10">
                      <input
                        type="checkbox"
                        aria-label="Sélectionner tous les hébergements visibles"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
                      />
                    </th>
                  )}
                  <th className="px-4 py-4 font-medium">Hébergement</th>
                  <th className="px-4 py-4 font-medium">Type</th>
                  <th className="px-4 py-4 font-medium">Localisation</th>
                  <th className="px-4 py-4 font-medium">Note</th>
                  <th className="px-4 py-4 font-medium">Statut</th>
                  <th className="px-4 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((property) => (
                  <tr
                    key={property.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${
                      selected.has(property.id) ? "bg-blue-50/50" : ""
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner ${property.name}`}
                          checked={selected.has(property.id)}
                          onChange={() => toggle(property.id)}
                          className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
                        />
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {property.mainImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={property.mainImage}
                              alt={property.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Building2 className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{property.name}</p>
                          {property.starRating && (
                            <p className="text-sm text-[#F5A623]">
                              {"★".repeat(property.starRating)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                        {getPropertyTypeLabel(property.type)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        {property.city}, {property.country}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {property.averageRating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-[#F5A623] fill-current" />
                          <span className="font-medium">
                            {parseFloat(property.averageRating).toFixed(1)}
                          </span>
                          <span className="text-sm text-gray-500">
                            ({property.totalReviews ?? 0})
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={getStatusBadgeColor(property.status ?? "pending")}>
                        {statusLabels[property.status ?? "pending"] ?? property.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/hebergement/${property.slug}`}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Voir"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                        <Link
                          href={`/dashboard/properties/${property.id}`}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </Link>
                        {isAdmin && (
                          <PropertyValidateActions
                            propertyId={property.id}
                            currentStatus={property.status ?? "pending"}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-400 mt-3">
        Raccourcis : <kbd className="px-1 bg-gray-100 rounded">/</kbd> chercher ·{" "}
        {isAdmin && (
          <>
            <kbd className="px-1 bg-gray-100 rounded">Ctrl+A</kbd> tout sélectionner ·{" "}
          </>
        )}
        <kbd className="px-1 bg-gray-100 rounded">Échap</kbd> vider
      </p>
    </div>
  );
}
