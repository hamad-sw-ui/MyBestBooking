"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";
import { Loader2, ArrowRight, CheckCircle } from "lucide-react";

/**
 * T-195 — bouton « Demander un versement » (version projetée → payout persisté).
 * Client : appelle POST /api/host/payouts puis recharge la page pour rafraîchir
 * le ledger. Le paiement client est intact ; ce bouton ne concerne que le versement.
 *
 * P6 : `currency` (optionnelle) — le POST ne traite QUE la devise de la ligne
 * (une ligne de projection = une devise), fini le double-déclenchement multi-devise.
 * P7 : la réponse `{ skipped, hasAccount }` est consommée pour informer l'hôte qu'un
 * versement reste en attente (devise incompatible avec le compte) ou qu'aucun
 * compte n'est configuré.
 */
export function PayoutRequestButton({
  periodStart,
  periodEnd,
  currency,
}: {
  periodStart: string;
  periodEnd: string;
  currency?: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // P7 — avertissement « versement mis en attente » (devise incompatible / pas de compte).
  // Le message doit être visible APRES le reload (qui rafraîchit le ledger) : on le
  // transporte via sessionStorage (clé de libellé) et on le lit au montage.
  const NOTICE_KEY = "mbb.payout.skipsNotice";
  const [notice, setNotice] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const key = sessionStorage.getItem(NOTICE_KEY);
    if (!key) return null;
    sessionStorage.removeItem(NOTICE_KEY);
    return t(key as Parameters<typeof t>[0]);
  });

  async function request() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/host/payouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd, currency }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? t("payouts.failed"));
      }
      setDone(true);
      // P7 : informer l'hôte d'un versement resté en attente (devise ≠ compte).
      // Stoque la clé pour affichage après reload, et la rend visible en l'état.
      if (Array.isArray(data.skipped) && data.skipped.length > 0) {
        sessionStorage.setItem(NOTICE_KEY, "payouts.skippedCurrency");
      } else if (data.hasAccount === false) {
        sessionStorage.setItem(NOTICE_KEY, "payouts.accountMissing");
      }
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
      {notice && <span className="text-xs text-amber-700" role="status">{notice}</span>}
    </div>
  );
}
