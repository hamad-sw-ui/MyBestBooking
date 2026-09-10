"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";

interface Props {
  bookingId: string;
  bookingReference: string;
  paymentStatus: string | null;
  /** T-203 : paiement constaté sur place (paiement manuel). */
  paymentMethodOffline: boolean;
  /** Hôte propriétaire ou admin : seul acteur autorisé à constater. */
  canManage: boolean;
  /** Séjour terminé (départ ≤ aujourd'hui) : le règlement est en retard. */
  overdue: boolean;
}

/**
 * T-222 (audit n°2) — colonne « Règlement » de la liste des réservations.
 *
 * Affiche l'état de règlement et permet à l'hôte/admin de le **constater**
 * (`PUT /api/bookings/[id] { markPaidOffline: true }`) sans ouvrir la fiche :
 * sans cette constatation, la clôture du séjour, les points de fidélité,
 * l'invitation à l'avis et la facture restent bloqués — et le séjour n'est
 * signalé par aucune autre surface (les tableaux de bord comptaient déjà les
 * revenus encaissés uniquement).
 *
 * Aucune logique métier ici : le serveur reste l'unique source de vérité
 * (garde 403 hors hôte/admin, 409 sur une réservation annulée, idempotence).
 */
export function BookingSettlementCell({
  bookingId,
  bookingReference,
  paymentStatus,
  paymentMethodOffline,
  canManage,
  overdue,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paid = paymentStatus === "paid";
  const label = paid
    ? paymentMethodOffline
      ? t("bulk.payOffline")
      : t("bulk.payPaid")
    : overdue
      ? t("bulk.payOverdue")
      : t("bulk.payPending");
  const tone = paid
    ? "bg-emerald-100 text-emerald-800"
    : overdue
      ? "bg-amber-100 text-amber-800"
      : "bg-gray-100 text-gray-700";

  async function markPaid() {
    if (!confirm(t("bulk.markPaidConfirm").replace("{ref}", bookingReference))) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markPaidOffline: true }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? t("settings.error"));
      }
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("settings.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
        {label}
      </span>
      {!paid && canManage && (
        <Button
          type="button"
          size="sm"
          variant={overdue ? "outline" : "ghost"}
          disabled={busy}
          onClick={markPaid}
          aria-label={t("bulk.markPaidAria").replace("{ref}", bookingReference)}
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" aria-hidden="true" />
          ) : (
            <BadgeCheck className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          )}
          {t("bulk.markPaid")}
        </Button>
      )}
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
