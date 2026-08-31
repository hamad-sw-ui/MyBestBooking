"use client";

import { useT } from "@/components/ui-locale-provider";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice } from "@/lib/utils";
import { BedDouble, Users, Maximize, Plus } from "lucide-react";
import { BulkToolbar, BulkIcons } from "./bulk-toolbar";
import { RowDeleteButton } from "./row-delete-button";

/**
 * <RoomsManager> (T-034) — dashboard `/dashboard/rooms` avec :
 *   - Recherche client (nom, hébergement, type)
 *   - Filtre statut (active/inactive)
 *   - Filtre type de chambre (single, double, ...)
 *   - Sélection multiple + bulk activate/deactivate/delete (admin uniquement)
 *   - Icône corbeille par ligne (admin uniquement)
 *   - Raccourcis clavier (via <BulkToolbar>) : /, Ctrl+A, Escape
 */

export interface RoomRow {
  id: string;
  propertyId: string;
  propertyName: string | null;
  name: string;
  roomType: string;
  maxOccupancy: number;
  quantity: number | null;
  sizeSqm: string | null;
  basePrice: string;
  currency: string | null;
  isActive: boolean | null;
  createdAt: string;
}


interface Props {
  rooms: RoomRow[];
  isAdmin: boolean;
}

export function RoomsManager({ rooms, isAdmin }: Props) {
  const t = useT();
  function roomTypeLabel(type: string): string {
    switch (type) {
      case "single": return t("room.type.single");
      case "double": return t("room.type.double");
      case "twin": return t("room.type.twin");
      case "suite": return t("room.type.suite");
      case "studio": return t("room.type.studio");
      case "dormitory": return t("room.type.dormitory");
      case "family": return t("room.type.family");
      default: return type;
    }
  }
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const types = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.roomType))).sort(),
    [rooms],
  );

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rooms.filter((r) => {
      if (statusFilter === "active" && !r.isActive) return false;
      if (statusFilter === "inactive" && r.isActive) return false;
      if (typeFilter !== "all" && r.roomType !== typeFilter) return false;
      if (!ql) return true;
      return (
        r.name.toLowerCase().includes(ql) ||
        (r.propertyName ?? "").toLowerCase().includes(ql) ||
        (roomTypeLabel(r.roomType)).toLowerCase().includes(ql)
      );
    });
  }, [rooms, q, statusFilter, typeFilter]);

  const allSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected);
      for (const r of filtered) next.delete(r.id);
      setSelected(next);
    } else {
      const next = new Set(selected);
      for (const r of filtered) next.add(r.id);
      setSelected(next);
    }
  }

  const stats = {
    total: rooms.length,
    active: rooms.filter((r) => r.isActive).length,
    units: rooms.reduce((s, r) => s + (r.quantity ?? 0), 0),
    avgPrice:
      rooms.length > 0
        ? rooms.reduce((s, r) => s + parseFloat(r.basePrice), 0) / rooms.length
        : 0,
  };

  const bulkActions = isAdmin
    ? [
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
          confirmMessage: t("bulk.confirmDeleteRooms").replace("{n}", String(selected.size)),
        },
      ]
    : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {t("dash.rooms")}
          </h1>
          <p className="text-gray-600 mt-1">
{t("bulk.manageRooms")}
          </p>
        </div>
        <Link href="/dashboard/rooms/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {t("prop.addRoom")}
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: t("bulk.total"), value: stats.total, color: "text-gray-900" },
          { label: t("bulk.activeFeminine"), value: stats.active, color: "text-green-600" },
          { label: t("bulk.units"), value: stats.units, color: "text-blue-600" },
          {
            label: t("bulk.avgPrice"),
            value: stats.avgPrice > 0 ? formatPrice(stats.avgPrice) : "—",
            color: "text-[#1B3A6B]",
          },
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
        entity="rooms"
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        onSelectAll={() => setSelected(new Set(filtered.map((r) => r.id)))}
        onDeselectAll={() => setSelected(new Set())}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder={t("bulk.searchRooms")}
        statusOptions={[
          { value: "all", label: t("bulk.allFeminine") },
          { value: "active", label: t("bulk.activeFeminine") },
          { value: "inactive", label: t("bulk.inactiveFeminine") },
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
            {t("bulk.allTypes")}
          </button>
          {types.map((ty) => (
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
              {roomTypeLabel(ty)}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-600 mb-3">
        {(filtered.length > 1 ? t("bulk.roomsShownMany") : t("bulk.roomsShown")).replace("{n}", String(filtered.length))}
        {filtered.length !== rooms.length && ` ${t("bulk.ofTotal").replace("{n}", String(rooms.length))}`}
        {selected.size > 0 && t("bulk.selectedSuffix").replace("{n}", String(selected.size))}
      </p>

      {isAdmin && filtered.length > 0 && (
        <div className="flex items-center gap-2 mb-3 pl-2">
          <input
            type="checkbox"
            id="rooms-select-all"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
          />
          <label htmlFor="rooms-select-all" className="text-sm text-gray-600">
{t("bulk.selectAllVisible")}
          </label>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BedDouble className="w-8 h-8" />}
            title={t("bulk.noRoomsTitle")}
            description={t("bulk.noRoomsDesc")}
            className="py-16"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((room) => (
            <Card
              key={room.id}
              className={`${!room.isActive ? "opacity-60" : ""} ${
                selected.has(room.id) ? "ring-2 ring-[#1B3A6B]/40" : ""
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {isAdmin && (
                      <input
                        type="checkbox"
                        aria-label={t("bulk.selectNamed").replace("{name}", room.name)}
                        checked={selected.has(room.id)}
                        onChange={() => toggle(room.id)}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {room.name}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {room.propertyName ?? "—"}
                      </p>
                    </div>
                  </div>
                  {!room.isActive && <Badge variant="default">{t("bulk.inactiveBadge")}</Badge>}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <BedDouble className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">
                      {roomTypeLabel(room.roomType)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <Users className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">
                      {t("bulk.persShort").replace("{n}", String(room.maxOccupancy))}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <Maximize className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">
                      {room.sizeSqm ?? "—"} m²
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xl font-bold text-[#1B3A6B]">
                      {formatPrice(room.basePrice, room.currency || "EUR")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {((room.quantity ?? 0) > 1 ? t("bulk.perNightUnitsMany") : t("bulk.perNightUnits")).replace("{n}", String(room.quantity ?? 0))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/rooms/${room.id}/calendrier`}
                      className="px-3 py-1.5 text-xs bg-[#1B3A6B] text-white rounded-lg hover:bg-[#0f2444]"
                      title={t("bulk.editCalendar")}
                    >
                      {t("bulk.calendar")}
                    </Link>
                    {isAdmin && (
                      <RowDeleteButton
                        entity="rooms"
                        id={room.id}
                        label={t("bulk.roomLabel").replace("{name}", room.name)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        {t("bulk.shortcuts")} <kbd className="px-1 bg-gray-100 rounded">/</kbd> {t("bulk.shortcutSearch")}{" "}
        {isAdmin && (
          <>
            · <kbd className="px-1 bg-gray-100 rounded">Ctrl+A</kbd> {t("bulk.shortcutSelectAll")}
          </>
        )}
        · <kbd className="px-1 bg-gray-100 rounded">Esc</kbd> {t("bulk.shortcutClear")}
      </p>
    </div>
  );
}
