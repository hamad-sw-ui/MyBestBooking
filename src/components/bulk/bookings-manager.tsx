"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar, Eye } from "lucide-react";
import { BulkToolbar, BulkIcons } from "./bulk-toolbar";

export interface BookingRow {
  booking: {
    id: string;
    bookingReference: string;
    status: string;
    paymentStatus: string | null;
    checkIn: string;
    checkOut: string;
    numAdults: number;
    numChildren: number | null;
    guestFirstName: string;
    guestLastName: string;
    guestEmail: string;
    total: string;
    currency: string | null;
    createdAt: string;
  };
  property: {
    id: string;
    name: string | null;
    city: string | null;
    mainImage: string | null;
  } | null;
  room: {
    name: string | null;
    roomType: string | null;
  } | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

const statusLabels: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
  no_show: "No-show",
};
const statusBadgeColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-gray-100 text-gray-800",
};

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}
function money(v: string, cur: string | null): string {
  const n = parseFloat(v);
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: cur ?? "EUR",
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cur ?? "EUR"}`;
  }
}

interface Props {
  bookings: BookingRow[];
  isAdmin: boolean;
}

export function BookingsManager({ bookings, isAdmin }: Props) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.booking.status !== statusFilter)
        return false;
      if (dateFrom && b.booking.checkIn < dateFrom) return false;
      if (dateTo && b.booking.checkOut > dateTo) return false;
      if (!ql) return true;
      return (
        b.booking.bookingReference.toLowerCase().includes(ql) ||
        b.booking.guestFirstName.toLowerCase().includes(ql) ||
        b.booking.guestLastName.toLowerCase().includes(ql) ||
        b.booking.guestEmail.toLowerCase().includes(ql) ||
        (b.property?.name ?? "").toLowerCase().includes(ql) ||
        (b.property?.city ?? "").toLowerCase().includes(ql)
      );
    });
  }, [bookings, q, statusFilter, dateFrom, dateTo]);

  // Bulk cancel : ne s'applique qu'aux bookings pending/confirmed (BUG-022 FSM)
  const cancellable = filtered.filter(
    (b) =>
      b.booking.status === "pending" || b.booking.status === "confirmed",
  );
  const allSelected =
    cancellable.length > 0 &&
    cancellable.every((b) => selected.has(b.booking.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected);
      for (const b of cancellable) next.delete(b.booking.id);
      setSelected(next);
    } else {
      const next = new Set(selected);
      for (const b of cancellable) next.add(b.booking.id);
      setSelected(next);
    }
  }

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.booking.status === "confirmed").length,
    pending: bookings.filter((b) => b.booking.status === "pending").length,
    revenue: bookings
      .filter((b) => b.booking.paymentStatus === "paid")
      .reduce((s, b) => s + parseFloat(b.booking.total), 0),
  };

  const bulkActions = isAdmin
    ? [
        {
          key: "cancel",
          label: "Annuler",
          icon: BulkIcons.reject,
          variant: "danger" as const,
          confirmMessage: `Annuler ${selected.size} réservation(s) ? Cette action est irréversible (BUG-022 machine à états).`,
        },
      ]
    : [];

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "Confirmées", value: stats.confirmed, color: "text-green-600" },
          { label: "En attente", value: stats.pending, color: "text-yellow-600" },
          {
            label: "Revenus",
            value: new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(stats.revenue),
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
        entity="bookings"
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        onSelectAll={() =>
          setSelected(new Set(cancellable.map((b) => b.booking.id)))
        }
        onDeselectAll={() => setSelected(new Set())}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Référence, client, hébergement, ville…"
        statusOptions={[
          { value: "all", label: "Tous statuts" },
          { value: "pending", label: "En attente" },
          { value: "confirmed", label: "Confirmée" },
          { value: "cancelled", label: "Annulée" },
          { value: "completed", label: "Terminée" },
          { value: "no_show", label: "No-show" },
        ]}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        actions={bulkActions}
      />

      {/* Filtre dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">
            Check-in à partir de
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">
            Check-out jusqu&apos;à
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none"
          />
        </label>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        {filtered.length} réservation{filtered.length > 1 ? "s" : ""} affichée
        {filtered.length > 1 ? "s" : ""}
        {filtered.length !== bookings.length && ` sur ${bookings.length}`}
        {selected.size > 0 && ` · ${selected.size} sélectionnée(s) annulable(s)`}
      </p>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            title="Aucune réservation"
            description="Aucune réservation ne correspond à vos filtres."
            className="py-16"
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
                        aria-label="Sélectionner toutes les réservations annulables visibles"
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={cancellable.length === 0}
                        className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
                      />
                    </th>
                  )}
                  <th className="px-4 py-4 font-medium">Référence</th>
                  <th className="px-4 py-4 font-medium">Client</th>
                  <th className="px-4 py-4 font-medium">Hébergement</th>
                  <th className="px-4 py-4 font-medium">Dates</th>
                  <th className="px-4 py-4 font-medium">Montant</th>
                  <th className="px-4 py-4 font-medium">Statut</th>
                  <th className="px-4 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ booking, property, room, user: guest }) => {
                  const canCancel =
                    booking.status === "pending" || booking.status === "confirmed";
                  return (
                    <tr
                      key={booking.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${
                        selected.has(booking.id) ? "bg-blue-50/50" : ""
                      }`}
                    >
                      {isAdmin && (
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            aria-label={`Sélectionner ${booking.bookingReference}`}
                            checked={selected.has(booking.id)}
                            onChange={() => toggle(booking.id)}
                            disabled={!canCancel}
                            title={!canCancel ? `Statut '${booking.status}' non annulable` : undefined}
                            className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B] disabled:opacity-30"
                          />
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <span className="font-mono text-sm font-medium text-[#1B3A6B]">
                          {booking.bookingReference}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-sm">
                            {booking.guestFirstName} {booking.guestLastName}
                          </p>
                          <p className="text-xs text-gray-500 break-all">
                            {booking.guestEmail}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm font-medium">{property?.name ?? "—"}</p>
                          <p className="text-xs text-gray-500">
                            {property?.city ?? ""} · {room?.name ?? ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <div>{fmt(booking.checkIn)}</div>
                        <div className="text-xs text-gray-400">
                          → {fmt(booking.checkOut)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">
                        {money(booking.total, booking.currency)}
                        {booking.paymentStatus === "paid" && (
                          <span className="ml-1 text-xs text-green-600">✓</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          className={
                            statusBadgeColor[booking.status] ??
                            "bg-gray-100 text-gray-800"
                          }
                        >
                          {statusLabels[booking.status] ?? booking.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/dashboard/bookings/${booking.id}`}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors inline-flex"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
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
