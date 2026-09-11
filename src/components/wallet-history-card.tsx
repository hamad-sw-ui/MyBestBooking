"use client";

import { useEffect, useState } from "react";
import { useT, useUiLocale } from "@/components/ui-locale-provider";
import { formatMoney } from "@/lib/i18n";
import type { UiStringKey } from "@/lib/ui-strings";

/**
 * T-248 (audit n°5, constat A6) — historique du wallet BestRewards.
 *
 * Lecture seule : liste les derniers mouvements (`GET /api/wallet/transactions`)
 * avec leur montant signé et le solde après opération. C'est la contrepartie
 * visible du journal `wallet_transactions` : un utilisateur peut enfin
 * expliquer son solde (« d'où vient ce montant ? »).
 *
 * Le solde affiché ailleurs (`account.walletTitle`) reste la source de vérité ;
 * ce bloc ne fait que l'illustrer et n'écrit jamais.
 */

interface WalletTransactionLine {
  id: string;
  amount: string;
  balanceAfter: string;
  kind: string;
  note: string | null;
  createdAt: string;
}

const KIND_KEYS: Record<string, UiStringKey> = {
  cashback: "wallet.kind.cashback",
  referral_referee: "wallet.kind.referralReferee",
  referral_referrer: "wallet.kind.referralReferrer",
  booking_refund: "wallet.kind.bookingRefund",
  booking_payment: "wallet.kind.bookingPayment",
  manual_adjustment: "wallet.kind.manualAdjustment",
};

export function WalletHistoryCard() {
  const t = useT();
  const locale = useUiLocale();
  const [lines, setLines] = useState<WalletTransactionLine[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wallet/transactions");
        if (!res.ok) throw new Error("load");
        const data = (await res.json()) as { transactions?: WalletTransactionLine[] };
        if (!cancelled) setLines(data.transactions ?? []);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="text-sm text-gray-500 mt-4" data-testid="wallet-history-error">
        {t("wallet.historyUnavailable")}
      </p>
    );
  }

  if (lines === null) {
    return (
      <p className="text-sm text-gray-500 mt-4" data-testid="wallet-history-loading">
        {t("wallet.historyLoading")}
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <p className="text-sm text-gray-500 mt-4" data-testid="wallet-history-empty">
        {t("wallet.historyEmpty")}
      </p>
    );
  }

  return (
    <div className="mt-5 border-t border-gray-100 pt-4" data-testid="wallet-history">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("wallet.historyTitle")}</h3>
      <ul className="space-y-2">
        {lines.map((line) => {
          const amount = Number(line.amount);
          const credit = amount > 0;
          return (
            <li
              key={line.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {t(KIND_KEYS[line.kind] ?? "wallet.kind.manualAdjustment")}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(line.createdAt).toLocaleDateString(locale)}
                  {line.note ? ` · ${line.note}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={credit ? "font-semibold text-green-700" : "font-semibold text-red-700"}>
                  {credit ? "+" : "−"}
                  {formatMoney(Math.abs(amount), "EUR", locale)}
                </p>
                <p className="text-xs text-gray-500">
                  {t("wallet.historyBalanceAfter").replace(
                    "{amount}",
                    formatMoney(Number(line.balanceAfter), "EUR", locale),
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
