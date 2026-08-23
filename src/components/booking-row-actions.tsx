"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageSquare, Download, XCircle, Loader2 } from "lucide-react";

interface Props {
  bookingId: string;
  bookingReference: string;
  propertyId: string;
  status: string;
  messageArea?: "traveler" | "dashboard";
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
  messageArea = "traveler",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    if (!confirm("Annuler cette réservation ? Des frais peuvent s'appliquer selon la politique.")) return;
    setError(null);
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

  function downloadConfirmation() {
    // Génère un .txt côté client (pas de PDF pour rester léger V1).
    const content =
      `MyBestBooking — Confirmation de réservation\n` +
      `===========================================\n\n` +
      `Référence : ${bookingReference}\n` +
      `Statut    : ${status}\n\n` +
      `Cet email confirme votre réservation. Un email détaillé\n` +
      `a été envoyé à votre adresse. Retrouvez le détail complet\n` +
      `dans "Mes réservations" sur mybestbooking.com.\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bookingReference}-confirmation.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={contactHost}>
        <MessageSquare className="w-4 h-4 mr-2" />
        Écrire à l&apos;hébergeur
      </Button>
      <Button variant="ghost" size="sm" onClick={downloadConfirmation}>
        <Download className="w-4 h-4 mr-2" />
        Confirmation
      </Button>
      {status === "confirmed" && (
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
