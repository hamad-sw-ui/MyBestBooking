"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Award, Gift, Copy, Check } from "lucide-react";

/**
 * Statut BestRewards PERSONNALISÉ (T-114). Affiche le niveau réel, le
 * nombre de séjours, le solde wallet et le code de parrainage de
 * l'utilisateur connecté (lus via /api/auth/me et
 * /api/users/me/referral). Le contenu descriptif des niveaux reste
 * statique dans la page ; ce composant montre l'état réel du compte.
 */
export function BestRewardsStatus({ thresholds }: { thresholds: [number, number] }) {
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
        Chargement de votre statut…
      </div>
    );
  }

  if (state === "anon") {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Votre programme BestRewards</h2>
        <p className="text-gray-600 mb-5">
          Connectez-vous ou créez un compte pour suivre votre niveau, votre cagnotte et votre code de parrainage.
        </p>
        <Link
          href="/inscription"
          className="inline-block px-6 py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg hover:bg-[#e54a4f]"
        >
          Créer mon compte
        </Link>
      </div>
    );
  }

  const levelNames = ["", "Explorer", "Voyageur", "Ambassador"];
  const nextThreshold = level >= 3 ? null : level === 1 ? thresholds[0] : thresholds[1];
  const remaining = nextThreshold === null ? 0 : Math.max(0, nextThreshold - bookings);
  const fmtWallet = `€${Number(wallet).toFixed(2)}`;

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
            Niveau {level} — {levelNames[level]}
          </h2>
          <p className="text-sm text-gray-500">
            {bookings} séjour{bookings !== 1 ? "s" : ""} terminé{bookings !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <Wallet className="w-5 h-5 text-[#00A699]" aria-hidden="true" />
          <div>
            <p className="text-xs text-gray-500">Cagnotte wallet</p>
            <p className="text-lg font-bold text-gray-900">{fmtWallet}</p>
          </div>
        </div>
        {referral && (
          <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <Gift className="w-5 h-5 text-[#F5A623]" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">Code de parrainage</p>
              <p className="text-lg font-bold tracking-wider text-gray-900">{referral}</p>
            </div>
            <button
              type="button"
              onClick={copyReferral}
              aria-label="Copier le code de parrainage"
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
        <p className="text-sm text-[#00A699] font-medium">
          🎉 Vous avez atteint le plus haut niveau : vous cumulez 5% de cashback sur chaque séjour.
        </p>
      ) : (
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progression vers le niveau {level + 1}</span>
            <span>
              {bookings}/{nextThreshold} séjours
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
            Encore {remaining} séjour{remaining !== 1 ? "s" : ""} pour passer au niveau supérieur.
          </p>
        </div>
      )}
    </div>
  );
}
