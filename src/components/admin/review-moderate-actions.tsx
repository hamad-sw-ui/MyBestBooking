"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, EyeOff, Ban, Clock } from "lucide-react";

type Status = "approved" | "pending" | "hidden" | "rejected";

interface Props {
  reviewId: string;
  currentStatus: string | null;
}

const STATUS_LABELS: Record<Status, string> = {
  approved: "Approuvé",
  pending: "En attente",
  hidden: "Masqué",
  rejected: "Rejeté",
};

const STATUS_VARIANTS: Record<Status, "success" | "warning" | "danger" | "info"> = {
  approved: "success",
  pending: "warning",
  hidden: "info",
  rejected: "danger",
};

/**
 * <ReviewModerateActions /> — bouton client (T-023).
 * Affiché uniquement pour les admins dans /dashboard/reviews.
 * Chaque action confirme, appelle PATCH /api/reviews/[id]/moderate,
 * puis `router.refresh()` pour recharger le RSC.
 */
export function ReviewModerateActions({ reviewId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const status = (currentStatus ?? "approved") as Status;

  function moderate(next: Status, verb: string) {
    setError(null);
    if (!confirm(`Confirmer : ${verb} cet avis ?`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/reviews/${reviewId}/moderate`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: "Erreur" }));
          throw new Error(j.error || "Erreur");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
      <span className="text-xs text-gray-500 mr-1">Modération :</span>
      <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>

      {status !== "approved" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => moderate("approved", "approuver")}
          disabled={isPending}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" /> Approuver
        </Button>
      )}
      {status !== "hidden" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => moderate("hidden", "masquer")}
          disabled={isPending}
        >
          <EyeOff className="w-4 h-4 mr-1" /> Masquer
        </Button>
      )}
      {status !== "pending" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => moderate("pending", "remettre en attente")}
          disabled={isPending}
        >
          <Clock className="w-4 h-4 mr-1" /> En attente
        </Button>
      )}
      {status !== "rejected" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => moderate("rejected", "rejeter (contenu inapproprié)")}
          disabled={isPending}
        >
          <Ban className="w-4 h-4 mr-1" /> Rejeter
        </Button>
      )}

      {error && <span className="text-xs text-red-600 w-full">{error}</span>}
    </div>
  );
}
