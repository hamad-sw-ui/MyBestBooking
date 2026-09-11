"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { CheckCircle2, EyeOff, Ban, Clock } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

type Status = "approved" | "pending" | "hidden" | "rejected";

interface Props {
  reviewId: string;
  currentStatus: string | null;
}

const STATUS_VARIANTS: Record<Status, "success" | "warning" | "danger" | "info"> = {
  approved: "success",
  pending: "warning",
  hidden: "info",
  rejected: "danger",
};

/** Statuts exigeant un motif (validation serveur identique, T-247). */
const REASON_REQUIRED: Status[] = ["hidden", "rejected"];

/**
 * <ReviewModerateActions /> — bouton client (T-023).
 * Affiché uniquement pour les admins dans /dashboard/reviews.
 *
 * T-247 (audit n°5, A3) : le motif n'est plus saisi dans `window.prompt` mais
 * dans un dialogue accessible, et il est **obligatoire** pour masquer ou
 * refuser un avis (le serveur refuse désormais l'absence de motif).
 */
export function ReviewModerateActions({ reviewId, currentStatus }: Props) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ status: Status; verb: string } | null>(null);
  const status = (currentStatus ?? "approved") as Status;

  function send(next: Status, reason?: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/reviews/${reviewId}/moderate`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: next,
            ...(reason?.trim() ? { moderationReason: reason.trim() } : {}),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: t("settings.error") }));
          throw new Error(j.error || t("settings.error"));
        }
        setPending(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("settings.error"));
      }
    });
  }

  function moderate(next: Status, verb: string) {
    setError(null);
    if (REASON_REQUIRED.includes(next)) {
      setPending({ status: next, verb });
      return;
    }
    if (!confirm(t("mod.confirm").replace("{verb}", verb))) return;
    send(next);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
      <span className="text-xs text-gray-500 mr-1">{t("mod.label")}</span>
      <Badge variant={STATUS_VARIANTS[status]}>{t(status === "approved" ? "mod.approved" : status === "pending" ? "mod.pending" : status === "hidden" ? "mod.hidden" : "mod.rejected")}</Badge>

      {status !== "approved" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => moderate("approved", t("mod.verbApprove"))}
          disabled={isPending}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" /> {t("mod.approve")}
        </Button>
      )}
      {status !== "hidden" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => moderate("hidden", t("mod.verbHide"))}
          disabled={isPending}
        >
          <EyeOff className="w-4 h-4 mr-1" /> {t("mod.hide")}
        </Button>
      )}
      {status !== "pending" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => moderate("pending", t("mod.verbHold"))}
          disabled={isPending}
        >
          <Clock className="w-4 h-4 mr-1" /> {t("mod.hold")}
        </Button>
      )}
      {status !== "rejected" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => moderate("rejected", t("mod.verbReject"))}
          disabled={isPending}
        >
          <Ban className="w-4 h-4 mr-1" /> {t("mod.reject")}
        </Button>
      )}

      {error && !pending && <span className="text-xs text-red-600 w-full">{error}</span>}

      <ReasonDialog
        key={pending ? `${pending.status}-${pending.verb}` : "closed"}
        open={pending !== null}
        onClose={() => {
          setPending(null);
          setError(null);
        }}
        onConfirm={(reason) => {
          if (pending) send(pending.status, reason);
        }}
        actionLabel={
          pending ? (pending.status === "hidden" ? t("mod.hide") : t("mod.reject")) : t("action.confirm")
        }
        busy={isPending}
        error={pending ? error : null}
      />
    </div>
  );
}
