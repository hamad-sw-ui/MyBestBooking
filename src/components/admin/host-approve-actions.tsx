"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react";

interface Props {
  userId: string;
  approvalStatus: string;
  commissionRate: string | null;
  disabled?: boolean;
}

/**
 * T-202 — boutons client d'approbation d'un compte hôte (Approuver / Rejeter)
 * réservés à l'admin. L'approbation fixe optionnellement un taux de commission
 * (% ) via PATCH /api/admin/hosts/[id].
 */
export function HostApproveActions({ userId, approvalStatus, commissionRate, disabled }: Props) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState<string>(commissionRate ?? "");

  const isPending = approvalStatus === "pending";
  const isRejected = approvalStatus === "rejected";
  const isLoading = pending;

  function submit(action: "approve" | "reject") {
    setError(null);
    const label = action === "approve" ? t("dash.approveHost") : t("dash.rejectHost");
    if (!confirm(action === "approve" ? t("user.confirmToggle").replace("{verb}", label) : t("user.confirmToggle").replace("{verb}", label))) return;
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = { action };
        if (action === "approve" && rate.trim() !== "") {
          const parsed = Number(rate.replace(",", "."));
          if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
            body.commissionRate = parsed;
          } else {
            throw new Error(t("dash.hostCommissionInvalid"));
          }
        }
        const res = await fetch(`/api/admin/hosts/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: t("settings.error") }));
          throw new Error(j.error || t("settings.error"));
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("settings.error"));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {(isPending || isRejected) && (
        <div className="flex items-center gap-1">
          {approvalStatus === "pending" && (
            <>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder={t("dash.hostCommission")}
                aria-label={t("dash.hostCommission")}
                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => submit("approve")}
                disabled={isLoading || disabled}
                className="text-green-700 hover:bg-green-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                {t("dash.approveHost")}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => submit("reject")}
            disabled={isLoading || disabled}
            className="text-red-600 hover:bg-red-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
            {t("dash.rejectHost")}
          </Button>
        </div>
      )}
      {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
    </div>
  );
}
