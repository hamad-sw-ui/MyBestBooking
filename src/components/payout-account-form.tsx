"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";
import { Loader2, CheckCircle } from "lucide-react";

/**
 * T-195 (G1) — formulaire de configuration du moyen de versement (hôte/admin).
 * Client : POST /api/host/payout-account (référence chiffrée AES-GCM côté
 * serveur, jamais stockée en clair) puis rechargement du ledger. Le paiement
 * client reste intact ; ce composant ne concerne que le versement.
 */
export function PayoutAccountForm({ defaultCurrency = "EUR" }: { defaultCurrency?: string }) {
  const t = useT();
  const [provider, setProvider] = useState<"stripe_connect" | "sepa">("sepa");
  const [reference, setReference] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency || "EUR");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/host/payout-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, reference, currency }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? t("payouts.accountError"));
      }
      setDone(true);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("payouts.accountError"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-xs text-gray-500">{t("payouts.period")}</span>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value as "stripe_connect" | "sepa")}
          >
            <option value="sepa">{t("payouts.accountProviderSepa")}</option>
            <option value="stripe_connect">{t("payouts.accountProviderConnect")}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-gray-500">{t("payouts.accountCurrency")}</span>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["EUR", "USD", "GBP", "XAF"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-xs text-gray-500">{provider === "sepa" ? t("payouts.accountIban") : t("payouts.accountProviderConnect")}</span>
        <input
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={provider === "sepa" ? "FR76 3000 6000 0112 3456 7890 189" : "acct_1A2B3C4D"}
          aria-label={t("payouts.accountIban")}
        />
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={busy || done || reference.trim().length < 8}>
          {busy
            ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("payouts.accountSaving")}</>)
            : done
              ? (<><CheckCircle className="w-4 h-4 mr-2 text-green-600" />{t("payouts.accountSaved")}</>)
              : (<>{t("payouts.accountSave")}</>)}
        </Button>
        {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
      </div>
    </div>
  );
}
