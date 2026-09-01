"use client";

import { useState } from "react";
import { Tag, Check, X } from "lucide-react";
import { formatPrice } from "@/lib/utils";
// T-154d (audit n°26, P2-8) : confirmation/échec globaux via le ToastProvider
// (monté dans layout mais jamais utilisé).
import { useToast } from "@/components/ui/toast";
import { useT, useUiLocale } from "@/components/ui-locale-provider";

interface Applied {
  code: string;
  discount: number;
  finalTotal: number;
  /** T-153 (audit n°25, B) : devise du discount renvoyée par l'API. */
  currency: string;
}

interface Props {
  amount: number;
  /** Devise du total (celle de la chambre). Défaut EUR = historique. */
  currency?: string;
  onApplied?: (a: Applied | null) => void;
}

/**
 * Champ code promo — simule l'application via
 * GET /api/promotions/apply?code=&amount=&currency= (T-016, T-153).
 */
export function PromoCodeInput({ amount, currency = "EUR", onApplied }: Props) {
  const { addToast } = useToast();
  const t = useT();
  const locale = useUiLocale();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Applied | null>(null);

  async function apply() {
    setError(null);
    setLoading(true);
    try {
      const url = `/api/promotions/apply?code=${encodeURIComponent(code)}&amount=${amount}&currency=${encodeURIComponent(currency)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("promo.invalid"));
      const a: Applied = {
        code: data.promotion.code,
        discount: data.discount,
        finalTotal: data.finalTotal,
        currency: data.currency ?? "EUR",
      };
      setApplied(a);
      onApplied?.(a);
      addToast("success", t("promo.appliedLine").replace("{code}", a.code).replace("{amount}", formatPrice(a.discount, a.currency, locale)));
    } catch (e) {
      setApplied(null);
      onApplied?.(null);
      setError(e instanceof Error ? e.message : t("auth.genericError"));
      addToast("error", e instanceof Error ? e.message : t("promo.applyFail"));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setApplied(null);
    setCode("");
    setError(null);
    onApplied?.(null);
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
        <div className="flex items-center gap-2 text-green-800">
          <Check className="w-4 h-4" />
          {t("promo.appliedLine").replace("{code}", applied.code).replace("{amount}", formatPrice(applied.discount, applied.currency, locale))}
        </div>
        <button
          type="button"
          onClick={reset}
          aria-label={t("promo.removeAria")}
          className="p-1 rounded hover:bg-green-100"
        >
          <X className="w-4 h-4 text-green-700" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="promo-code" className="block text-xs text-gray-500 mb-1">
          {t("promo.codeLabel")}
        </label>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="promo-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            placeholder={t("promo.codePlaceholder")}
          />
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button
        type="button"
        onClick={apply}
        disabled={loading || !code.trim()}
        className="px-4 py-2 text-sm bg-[#1B3A6B] text-white rounded-lg hover:bg-[#0f2444] disabled:opacity-50"
      >
        {loading ? "…" : t("promo.apply")}
      </button>
    </div>
  );
}
