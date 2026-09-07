"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";
import { Loader2, ArrowRight, CheckCircle } from "lucide-react";

/**
 * T-195 — bouton « Demander un versement » (version projetée → payout persisté).
 * Client : appelle POST /api/host/payouts puis recharge la page pour rafraîchir
 * le ledger. Le paiement client est intact ; ce bouton ne concerne que le versement.
 */
export function PayoutRequestButton({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/host/payouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? t("payouts.failed"));
      }
      setDone(true);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("payouts.failed"));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={request}
        disabled={busy || done}
      >
        {busy
          ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("payouts.requesting")}</>)
          : done
            ? (<><CheckCircle className="w-4 h-4 mr-2 text-green-600" />{t("payouts.requested").replace("{status}", t("payouts.pending"))}</>)
            : (<><ArrowRight className="w-4 h-4 mr-2" />{t("payouts.request")}</>)}
      </Button>
      {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
    </div>
  );
}
