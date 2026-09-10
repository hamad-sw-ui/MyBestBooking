"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";
import { useToast } from "@/components/ui/toast";
import { availableTransitions, type BookingActor, type BookingStatus } from "@/lib/booking-lifecycle";

interface Props {
  bookingId: string;
  bookingReference: string;
  status: string;
  /** Renseigné par la liste : sert à ne pas proposer `completed` avant paiement. */
  paymentStatus?: string | null;
  /** Échéance du séjour : garde les clôtures après la date de départ. */
  checkOut?: string | null;
  /** Rôle effectif de l'utilisateur courant (un admin a les mêmes droits que l'hôte). */
  actor: Extract<BookingActor, "admin" | "host">;
  /** Badge de statut : fourni par l'appelant pour préserver l'affichage existant. */
  badge: React.ReactNode;
  /** Titre natif explicatif quand aucune transition n'est proposable. */
  disabledHint?: string;
}

/**
 * T-216 — gestion manuelle du statut d'une réservation **dans la liste**
 * (`/dashboard/bookings`), pour l'hôte propriétaire et l'admin.
 *
 * Aucune nouvelle route : la mise à jour passe par `PUT /api/bookings/[id]`,
 * qui reste l'unique source de vérité (FSM `transitionError`, verrou
 * transactionnel, e-mails, fidélité, remboursements). Ce composant ne fait
 * qu'afficher les transitions que le serveur accepterait
 * (`availableTransitions`) et relayer la réponse.
 *
 * Le badge existant est conservé à l'identique : la colonne Statut garde son
 * rendu actuel quand aucune transition n'est possible (états terminaux,
 * séjour non payé, séjour en cours…).
 */
export function BookingStatusSelect({
  bookingId,
  bookingReference,
  status,
  paymentStatus = null,
  checkOut = null,
  actor,
  badge,
  disabledHint,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    pending: t("status.pending"),
    confirmed: t("status.confirmed"),
    cancelled: t("status.cancelled"),
    completed: t("status.completed"),
    no_show: t("status.no_show"),
  };

  const transitions = availableTransitions({
    current: status as BookingStatus,
    actor,
    // Sans échéance connue, on laisse la garde serveur trancher (aucune
    // transition n'est masquée à tort).
    checkOut: checkOut ?? "1970-01-01",
    paymentStatus,
  })
    // L'annulation est destructive : proposée en dernier, après les actions
    // de progression du cycle de vie.
    .sort((a, b) => (a === "cancelled" ? 1 : 0) - (b === "cancelled" ? 1 : 0));

  if (transitions.length === 0) {
    return (
      <div title={disabledHint} className="inline-flex">
        {badge}
      </div>
    );
  }

  async function apply(next: BookingStatus) {
    setError(null);
    if (next === "cancelled" && !confirm(t("bookings.confirmCancel"))) return;
    if ((next === "completed" || next === "no_show") && !confirm(t("bookings.confirmStatusChange").replace("{status}", statusLabels[next] ?? next))) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? t("settings.error"));
      }
      addToast("success", t("bookings.statusUpdated").replace("{status}", statusLabels[next] ?? next));
      setEditing(false);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t("settings.error");
      setError(message);
      addToast("error", message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <div className="inline-flex items-center gap-2">
          {badge}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-[#1B3A6B] hover:bg-gray-100 transition-colors"
            title={t("bookings.changeStatus")}
            aria-label={`${t("bookings.changeStatus")} — ${bookingReference}`}
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
        {error && (
          <span className="text-xs text-red-600" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        <select
          aria-label={`${t("bookings.changeStatus")} — ${bookingReference}`}
          aria-busy={busy}
          disabled={busy}
          defaultValue={status}
          onChange={(event) => {
            const next = event.target.value as BookingStatus;
            if (next !== status) void apply(next);
          }}
          className="py-1.5 px-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none disabled:bg-gray-50"
        >
          <option value={status}>{statusLabels[status] ?? status}</option>
          {transitions.map((next) => (
            <option key={next} value={next}>
              {statusLabels[next] ?? next}
            </option>
          ))}
        </select>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-gray-500" aria-hidden="true" />}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          {t("action.cancel")}
        </Button>
      </div>
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
