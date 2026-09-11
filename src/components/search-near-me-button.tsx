"use client";

import { useState, type MouseEvent } from "react";
import { LocateFixed } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";
import { buildNearHref, NEAR_RADIUS_KM } from "@/lib/geo-distance";

/**
 * T-260 (audit n°6, B7) — bouton « Autour de moi ».
 *
 * `GET /api/properties?near=lat,lng,km` existait depuis T-026 sans bouton :
 * l'utilisateur devait taper des coordonnées. Ici, la position vient de
 * `navigator.geolocation` ; les filtres déjà saisis sont **conservés** (lus
 * sur le formulaire parent) et `page` est remis à 1.
 *
 * Replis, dans l'ordre : pas de géolocalisation → message ; refus / échec /
 * délai dépassé → message invitant à saisir une ville. Aucun rendu ni envoi
 * par défaut n'est modifié : sans clic, le formulaire est celui d'avant, et
 * sans JavaScript le bouton est simplement inerte (le reste reste un GET).
 */
export function SearchNearMeButton() {
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setMessage(t("search.nearUnsupported"));
      return;
    }

    setPending(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current = new URLSearchParams();
        if (form) {
          for (const [key, value] of new FormData(form).entries()) {
            if (typeof value === "string" && value.trim() !== "") current.set(key, value);
          }
        }
        // `assign` : navigation complète, comme la soumission GET du
        // formulaire (l'état du formulaire n'est pas à préserver).
        window.location.assign(
          buildNearHref(current, {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        );
      },
      () => {
        setPending(false);
        setMessage(t("search.nearDenied"));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="w-[170px]">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border border-[#1B3A6B] text-[#1B3A6B] rounded-lg text-sm font-medium hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] disabled:opacity-60"
        title={t("search.nearMeHint").replace("{km}", String(NEAR_RADIUS_KM))}
      >
        <LocateFixed className="w-4 h-4" />
        {pending ? t("search.nearPending") : t("search.nearMe")}
      </button>
      {message && (
        <p role="alert" className="mt-1 text-xs text-amber-700">
          {message}
        </p>
      )}
    </div>
  );
}
