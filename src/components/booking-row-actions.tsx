"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileText, XCircle, Loader2, CheckCircle2, UserX, CreditCard } from "lucide-react";

interface Props {
  bookingId: string;
  bookingReference: string;
  propertyId: string;
  status: string;
  /** T-152 : état de paiement, permet d'offrir « Payer maintenant » aux pending. */
  paymentStatus?: string | null;
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
  messageArea = "traveler",
  canManageStay = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setError(null);
    try {
      const quoteResponse = await fetch(`/api/bookings/${bookingId}/cancellation`, { cache: "no-store" });
      const quote = await quoteResponse.json().catch(() => ({}));
      if (!quoteResponse.ok) throw new Error(quote.error ?? "Impossible de calculer l'annulation");
      const message = `Annuler cette réservation ?\n\nFrais estimés : ${quote.cancellationFee} ${quote.currency}\nRemboursement estimé : ${quote.estimatedRefund} ${quote.currency}`;
      if (!confirm(message)) return;
      startTransition(async () => {
        try {
          const r = await fetch(`/api/bookings/${bookingId}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "cancelled", cancellationReason: "Annulation demandée par le voyageur" }),
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error ?? "Erreur");
          }
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erreur");
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
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
      if (!response.ok) throw new Error(data.error ?? "Impossible d'ouvrir la conversation");
      router.push(messageArea === "dashboard" ? `/dashboard/messages/${data.conversation.id}` : `/messages/${data.conversation.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erreur");
    }
  }

  // T-130 : clôture du séjour par l'hôte/admin. Le serveur rejette toute
  // transition invalide (acteur non autorisé, avant la date de départ) avec un
  // message explicite ; on ne fait que relayer.
  async function setStayStatus(next: "completed" | "no_show") {
    setError(null);
    const label = next === "completed" ? "Terminer le séjour" : "Marquer comme non-présentation";
    const confirmMsg = next === "completed"
      ? "Confirmer que ce séjour est terminé ? La récompense BestRewards du voyageur sera alors créditée."
      : "Marquer cette réservation comme non-présentation (no-show) ? Aucune récompense ne sera versée.";
    if (!confirm(confirmMsg)) return;
    setBusyAction(next);
    try {
      const r = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Erreur lors de : ${label}`);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={contactHost}>
        <MessageSquare className="w-4 h-4 mr-2" />
        Écrire à l&apos;hébergeur
      </Button>
      {canManageStay && status === "confirmed" && (
        <>
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
            Terminer le séjour
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
            No-show
          </Button>
        </>
      )}
      <a
        href={`/api/bookings/${bookingId}/invoice`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Voir la facture ou le reçu de la réservation ${bookingReference}`}
        className="inline-flex items-center text-sm px-3 py-1.5 rounded-lg bg-transparent hover:bg-gray-100 text-gray-700 transition-all duration-200"
      >
        <FileText className="w-4 h-4 mr-2" />
        Facture / Reçu
      </a>
      {/* T-152 (audit n°24, A) : une réservation pending (paiement non
          finalisé, intent expiré, checkout abandonné) doit rester actionnable.
          L'API /api/bookings/[id]/payment et l'annulation pending existent
          déjà ; on expose juste les actions. */}
      {status === "pending" && paymentStatus === "pending" && (
        <Link
          href={`/reservation?booking=${bookingId}`}
          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#1B3A6B] text-white text-sm font-medium hover:bg-[#152d54] transition"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Payer maintenant
        </Link>
      )}
      {status === "pending" && paymentStatus !== "pending" && (
        <span className="inline-flex items-center text-sm px-3 py-1.5 text-amber-700 bg-amber-50 rounded-lg">
          <Loader2 className="w-4 h-4 mr-2" />
          Paiement en cours de confirmation
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
          Annuler
        </Button>
      )}
      {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
    </>
  );
}
