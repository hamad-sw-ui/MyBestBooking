"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";
import { ReasonDialog } from "@/components/admin/reason-dialog";

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
  /** T-273 (audit n°8, F3) : état de remboursement — la finalisation
   *  n'est proposée que sur `none` (la voie PSP gère le reste). */
  refundStatus?: string | null;
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
  refundStatus = "none",
}: Props) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // T-273 (audit n°8, F3) : dialogue de motif de finalisation de remboursement.
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);

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

  // T-273 (audit n°8, F3) : finaliser un remboursement déjà effectué hors
  // plateforme (constat comptable, motif obligatoire tracé dans l'audit log).
  // Le serveur reste la source de vérité (403/409, idempotence).
  async function finalizeRefund(reason: string) {
    setError(null);
    setRefundBusy(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Le dialogue reste ouvert avec l'erreur (le motif est conservé).
        throw new Error(payload.error ?? t("settings.error"));
      }
      setRefundDialogOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("settings.error"));
    } finally {
      setRefundBusy(false);
    }
  }

  const canFinalizeRefund = paid && paymentMethodOffline && canManage && refundStatus === "none";

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
      {canFinalizeRefund && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={refundBusy}
          onClick={() => setRefundDialogOpen(true)}
          aria-label={t("book.finalizeRefund")}
          className="text-teal-700 hover:text-teal-800 hover:bg-teal-50"
        >
          {refundBusy ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" aria-hidden="true" />
          ) : (
            <Undo2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          )}
          {t("book.finalizeRefund")}
        </Button>
      )}
      {canFinalizeRefund && (
        <ReasonDialog
          key={bookingId}
          open={refundDialogOpen}
          onClose={() => setRefundDialogOpen(false)}
          onConfirm={(reason) => void finalizeRefund(reason)}
          actionLabel={t("book.finalizeRefund")}
          destructive={false}
          busy={refundBusy}
          error={error}
        />
      )}
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
