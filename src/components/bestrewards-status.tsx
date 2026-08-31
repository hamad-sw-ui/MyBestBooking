"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Award, Gift, Copy, Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useT } from "@/components/ui-locale-provider";

/**
 * Statut BestRewards PERSONNALISÉ (T-114). Affiche le niveau réel, le
 * nombre de séjours, le solde wallet et le code de parrainage de
 * l'utilisateur connecté (lus via /api/auth/me et
 * /api/users/me/referral). Le contenu descriptif des niveaux reste
 * statique dans la page ; ce composant montre l'état réel du compte.
 */
export function BestRewardsStatus({ thresholds }: { thresholds: [number, number] }) {
  const t = useT();
  const [state, setState] = useState<"loading" | "anon" | "ready">("loading");
  const [level, setLevel] = useState(1);
  const [bookings, setBookings] = useState(0);
  const [wallet, setWallet] = useState("0.00");
  const [referral, setReferral] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.status === 401) {
          if (active) setState("anon");
          return;
        }
        const me = await meRes.json();
        if (!active) return;
        setLevel(Number(me.user?.bestrewardsLevel ?? 1));
        setBookings(Number(me.user?.bestrewardsBookingsCount ?? 0));
        setWallet(me.user?.walletBalance ?? "0.00");

        const refRes = await fetch("/api/users/me/referral");
        if (refRes.ok) {
          const ref = await refRes.json();
          if (active) setReferral(ref.code ?? "");
        }
        if (active) setState("ready");
      } catch {
        if (active) setState("anon");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-gray-400" aria-busy="true">
{t("br.loadingStatus")}
      </div>
    );
  }

  if (state === "anon") {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
<h2 className="text-xl font-bold text-gray-900 mb-2">{t("br.yourProgram")}</h2>
        <p className="text-gray-600 mb-5">{t("br.anonBody")}</p>
        <Link
          href="/inscription"
          className="inline-block px-6 py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg hover:bg-[#e54a4f]"
        >
{t("auth.createAccountCta")}
        </Link>
      </div>
    );
  }

  const levelNames = ["", t("bestrewards.level1Name"), t("bestrewards.level2Name"), t("bestrewards.level3Name")];
  const nextThreshold = level >= 3 ? null : level === 1 ? thresholds[0] : thresholds[1];
  const remaining = nextThreshold === null ? 0 : Math.max(0, nextThreshold - bookings);
  // T-153 (audit n°25, E) : le solde wallet est libellé en EUR (cagnotte
  // BestRewards) — affichage toujours en euros, quelle que soit la devise
  // d'affichage préférée.
  const fmtWallet = formatPrice(Number(wallet), "EUR");

  const copyReferral = async () => {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponible : le code reste sélectionnable/visible.
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#1B3A6B]/10 flex items-center justify-center">
          <Award className="w-6 h-6 text-[#1B3A6B]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {t("br.levelTitle").replace("{n}", String(level)).replace("{name}", levelNames[level])}
          </h2>
          <p className="text-sm text-gray-500">
            {(bookings !== 1 ? t("br.staysMany") : t("br.staysOne")).replace("{n}", String(bookings))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <Wallet className="w-5 h-5 text-[#00A699]" aria-hidden="true" />
          <div>
<p className="text-xs text-gray-500">{t("br.wallet")}</p>
            <p className="text-lg font-bold text-gray-900">{fmtWallet}</p>
          </div>
        </div>
        {referral && (
          <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <Gift className="w-5 h-5 text-[#F5A623]" aria-hidden="true" />
            <div className="flex-1">
<p className="text-xs text-gray-500">{t("br.referral")}</p>
              <p className="text-lg font-bold tracking-wider text-gray-900">{referral}</p>
            </div>
            <button
              type="button"
              onClick={copyReferral}
aria-label={t("referral.copyAria")}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              {copied ? (
                <Check className="w-5 h-5 text-[#00A699]" aria-hidden="true" />
              ) : (
                <Copy className="w-5 h-5 text-gray-500" aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>

      {nextThreshold === null ? (
        <p className="text-sm text-[#00A699] font-medium">{t("br.maxLevel")}</p>
      ) : (
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
<span>{t("br.progressTo").replace("{n}", String(level + 1))}</span>
            <span>
              {t("br.staysProgress").replace("{a}", String(bookings)).replace("{b}", String(nextThreshold))}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar"
            aria-valuenow={bookings} aria-valuemin={0} aria-valuemax={nextThreshold}>
            <div
              className="h-full bg-[#1B3A6B] transition-all"
              style={{ width: `${Math.min(100, Math.round((bookings / nextThreshold) * 100))}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {(remaining !== 1 ? t("br.stillMany") : t("br.stillOne")).replace("{n}", String(remaining))}
          </p>
        </div>
      )}
    </div>
  );
}
