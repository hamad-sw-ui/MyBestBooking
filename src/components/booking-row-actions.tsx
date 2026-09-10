"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileText, XCircle, Loader2, CheckCircle2, UserX, ThumbsUp, BadgeCheck, Clock } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

interface Props {
  bookingId: string;
  bookingReference: string;
  propertyId: string;
  status: string;
  /** État de règlement informatif ; aucune action de paiement en ligne n’est exposée. */
  paymentStatus?: string | null;
  /** T-203 : paiement constaté sur place (paiement manuel) pour afficher le badge. */
  paymentMethodOffline?: boolean;
  /** Legacy : conservé pour compatibilité d’appel, non utilisé depuis T-207. */
  paymentIntentId?: string | null;
  messageArea?: "traveler" | "dashboard";
  /**
   * T-130 : true quand l'utilisateur courant est l'hôte du bien (ou admin) en
   * vue dashboard. Affiche les actions de clôture de séjour (terminer /
   * no-show), jusque-là joignables uniquement via l'API. Le serveur reste la
   * source de vérité (transitionError valide l'acteur et la date de départ).
   */
  canManageStay?: boolean;
}

/**
 * <BookingRowActions /> (T-031)
 * Boutons fonctionnels pour une ligne de réservation dans
 * /mes-reservations :
 * - Contacter → mailto vers l'hôte (fallback support si pas d'email)
 * - Confirmation → génère un .txt de confirmation téléchargeable côté client
 * - Annuler → PUT /api/bookings/[id] status:cancelled avec confirmation
 */
export function BookingRowActions({
  bookingId,
  bookingReference,
  propertyId,
  status,
  paymentStatus = null,
  paymentMethodOffline = false,
  messageArea = "traveler",
  canManageStay = false,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setError(null);
    try {
      // T-156 (audit n°29) : vue hôte/admin → l'annulation est sans frais
      // pour le voyageur (remboursement intégral) et la raison est forcée
      // par le serveur ; la vue voyageur garde le devis + politique.
      if (canManageStay) {
        const confirmMsg = t("book.cancelGuestConfirm");
        if (!confirm(confirmMsg)) return;
        startTransition(async () => {
          try {
            const r = await fetch(`/api/bookings/${bookingId}`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ status: "cancelled" }),
            });
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              throw new Error(j.error ?? t("settings.error"));
            }
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : t("settings.error"));
          }
        });
        return;
      }
      const quoteResponse = await fetch(`/api/bookings/${bookingId}/cancellation`, { cache: "no-store" });
      const quote = await quoteResponse.json().catch(() => ({}));
      if (!quoteResponse.ok) throw new Error(quote.error ?? t("book.cancelQuoteFail"));
      const message = t("book.cancelQuote").replace("{fee}", String(quote.cancellationFee)).replace("{refund}", String(quote.estimatedRefund)).replaceAll("{currency}", String(quote.currency));
      if (!confirm(message)) return;
      startTransition(async () => {
        try {
          const r = await fetch(`/api/bookings/${bookingId}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "cancelled", cancellationReason: t("book.cancelReasonGuest") }),
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
              throw new Error(j.error ?? t("settings.error"));
          }
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : t("settings.error"));
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.error"));
    }
  }

  async function contactHost() {
    setError(null);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, bookingId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? t("book.openConvFail"));
      router.push(messageArea === "dashboard" ? `/dashboard/messages/${data.conversation.id}` : `/messages/${data.conversation.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("settings.error"));
    }
  }

  // T-202 : l'hôte confirme manuellement une demande de réservation
  // (`pending` → `confirmed`) — plus de paiement automatique.
  async function confirmRequest() {
    setError(null);
    setBusyAction("confirmed");
    try {
      const r = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? t("settings.error"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("book.actionError").replace("{label}", t("book.confirmRequest")));
    } finally {
      setBusyAction(null);
    }
  }

  // T-203 : l'hôte/admin constate que le paiement a été effectué sur place
  // (paiement manuel). PUT /api/bookings/[id] { markPaidOffline: true } →
  // paymentStatus:"paid" + paymentMethodOffline:true. Le badge s'affiche après.
  async function markPaidOffline() {
    setError(null);
    setBusyAction("offline");
    try {
      const r = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markPaidOffline: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? t("settings.error"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("book.actionError").replace("{label}", t("book.markPaidOffline")));
    } finally {
      setBusyAction(null);
    }
  }

  // T-130 : clôture du séjour par l'hôte/admin. Le serveur rejette toute
  // transition invalide (acteur non autorisé, avant la date de départ) avec un
  // message explicite ; on ne fait que relayer.
  async function setStayStatus(next: "completed" | "no_show") {
    setError(null);
    const label = next === "completed" ? t("book.completeStay") : t("book.noShow");
    const confirmMsg = next === "completed"
      ? t("book.completeStayConfirm")
      : t("book.noShowConfirm");
    if (!confirm(confirmMsg)) return;
    setBusyAction(next);
    try {
      const r = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? t("settings.error"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("book.actionError").replace("{label}", label));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={contactHost}>
        <MessageSquare className="w-4 h-4 mr-2" />
{t("book.writeHost")}
      </Button>
      {/* T-203 : badge « Payé sur place » — l'hôte a constaté le règlement manuel. */}
      {paymentMethodOffline && (
        <span className="inline-flex items-center text-sm px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
          <BadgeCheck className="w-4 h-4 mr-2" />
          {t("pay.manualConfirmed")}
        </span>
      )}
      {/* T-202 : l'hôte/admin confirme la demande (pending → confirmed) à la main. */}
      {canManageStay && status === "pending" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={confirmRequest}
          disabled={busyAction !== null}
          className="text-blue-700 hover:text-blue-800 hover:bg-blue-50"
        >
          {busyAction === "confirmed" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ThumbsUp className="w-4 h-4 mr-2" />
          )}
          {t("book.confirmRequest")}
        </Button>
      )}
      {canManageStay && status === "confirmed" && (
        <>
          {/* T-203 : constater le paiement sur place (paiement manuel). */}
          {!paymentMethodOffline && paymentStatus !== "paid" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markPaidOffline}
              disabled={busyAction !== null}
              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
            >
              {busyAction === "offline" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BadgeCheck className="w-4 h-4 mr-2" />
              )}
              {t("book.markPaidOffline")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStayStatus("completed")}
            disabled={busyAction !== null}
            className="text-green-700 hover:text-green-800 hover:bg-green-50"
          >
            {busyAction === "completed" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
{t("book.completeStay")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStayStatus("no_show")}
            disabled={busyAction !== null}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100"
          >
            {busyAction === "no_show" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <UserX className="w-4 h-4 mr-2" />
            )}
            {t("book.noShow")}
          </Button>
        </>
      )}
      {/* T-206/F11: payment documents are shown only after a settled payment.
          The API remains defensive for legacy direct links. */}
      {paymentStatus === "paid" && (
        <a
          href={`/api/bookings/${bookingId}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("book.invoiceAria").replace("{ref}", bookingReference)}
          className="inline-flex items-center text-sm px-3 py-1.5 rounded-lg bg-transparent hover:bg-gray-100 text-gray-700 transition-all duration-200"
        >
          <FileText className="w-4 h-4 mr-2" />
{t("book.invoiceReceipt")}
        </a>
      )}
      {/* T-207 : plus aucun lien « Payer maintenant » ni reprise d'intent.
          Une réservation pending reste une demande à confirmer/traiter par
          owner host, même si d'anciens champs paymentIntentId existent en base. */}
      {status === "pending" && paymentStatus !== "pending" && (
        <span className="inline-flex items-center text-sm px-3 py-1.5 text-amber-700 bg-amber-50 rounded-lg">
          <Loader2 className="w-4 h-4 mr-2" />
{t("reservation.paymentConfirming")}
        </span>
      )}
      {status === "pending" && paymentStatus === "pending" && (
        <span className="inline-flex items-center text-sm px-3 py-1.5 text-amber-700 bg-amber-50 rounded-lg">
          <Clock className="w-4 h-4 mr-2" />
          {t("book.paymentAwaitingHost")}
        </span>
      )}
      {(status === "confirmed" || status === "pending") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={cancel}
          disabled={isPending}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4 mr-2" />
          )}
{t("action.cancel")}
        </Button>
      )}
      {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
    </>
  );
}
