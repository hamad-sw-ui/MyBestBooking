"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Loader2 } from "lucide-react";
import { useT, useUiLocale } from "@/components/ui-locale-provider";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { convertAmount, formatMoney, normalizeDisplayCurrency } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";

/**
 * <DeleteAccountSection /> (T-030) — supprime définitivement le compte
 * (soft-delete côté DB, révoque toutes les sessions).
 * Confirmation par saisie du mot « SUPPRIMER » pour éviter les erreurs.
 */
export function DeleteAccountSection({
  walletBalance = null,
}: {
  /**
   * T-262 (audit n°6, B8) : solde de crédit gelé (EUR) affiché au moment de la
   * confirmation — un crédit accumulé disparaissait jusqu'ici sans un mot.
   */
  walletBalance?: string | null;
}) {
  const t = useT();
  const locale = useUiLocale();
  const { currency: displayCurrency } = useDisplayPreferences();
  const router = useRouter();
  const confirmWord = t("account.deleteConfirmWord");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletEur = Number.parseFloat(walletBalance ?? "0");
  const walletLabel =
    Number.isFinite(walletEur) && walletEur > 0
      ? (() => {
          const target = normalizeDisplayCurrency(displayCurrency, "EUR");
          return target === "EUR"
            ? formatPrice(walletEur, "EUR", locale)
            : formatMoney(convertAmount(walletEur, "EUR", target), target, locale);
        })()
      : null;

  async function del() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/users/me", { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t("auth.error"));
      // Le cookie a été retiré côté serveur, on redirige vers /
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.error"));
      setBusy(false);
    }
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-600">{t("account.dangerZone")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="font-medium text-red-600">{t("account.deleteAccount")}</p>
            <p className="text-sm text-gray-500">
              {t("account.deleteBody")}
            </p>
          </div>
          {walletLabel && (
            // T-262 (audit n°6, B8) : crédit gelé (aucune consommation) — le
            // montant affiché suit la devise d'affichage comme la carte wallet.
            <p
              role="note"
              className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3"
            >
              {t("account.deleteWalletWarning").replace("{amount}", walletLabel)}
            </p>
          )}
          <Input
            label={t("account.deleteConfirmLabel").replace("{word}", confirmWord)}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            aria-label={t("account.deleteAria")}
          />
          <Button
            variant="danger"
            size="sm"
            onClick={del}
            disabled={busy || confirmText !== confirmWord}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {t("account.deleteForever")}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
