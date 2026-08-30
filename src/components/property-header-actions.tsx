"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Share2 } from "lucide-react";
import { useWishlistToggle } from "@/lib/use-wishlist-toggle";
// T-154d (audit n°26, P2-8) : confirmation favori via ToastProvider.
import { useToast } from "@/components/ui/toast";
// T-158 (audit n°29) : actions de la fiche publique localisées (favori,
// partage) — un visiteur en compte EN ne doit plus voir de libellés FR.
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { makeT } from "@/lib/ui-strings";

/** Actions réelles de fiche : favori API (ajout + retrait, T-154c/P2-6)
 * et partage Web Share/clipboard. */
export function PropertyHeaderActions({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const favorite = useWishlistToggle(propertyId);
  const router = useRouter();
  const { addToast } = useToast();
  const { language } = useDisplayPreferences();
  const t = makeT(language);
  const [message, setMessage] = useState<string | null>(null);

  async function toggleFavorite() {
    if (favorite.busy) return;
    const wasSaved = favorite.saved;
    setMessage(null);
    const outcome = await favorite.toggle();
    if (outcome === "unauthenticated") {
      router.push("/connexion?next=" + encodeURIComponent(window.location.pathname));
      return;
    }
    const text = wasSaved ? t("headerActions.favoriteRemoved") : t("headerActions.favoriteAdded");
    setMessage(text);
    addToast(wasSaved ? "info" : "success", text);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: propertyName, url });
      else { await navigator.clipboard.writeText(url); setMessage(t("headerActions.linkCopied")); }
    } catch { /* annulation partage : aucune erreur visible */ }
  }

  const favoriteLabel = favorite.saved ? t("headerActions.favoriteRemove") : t("headerActions.favoriteAdd");

  return <div className="flex items-center gap-2 relative">
    <button type="button" onClick={toggleFavorite} aria-label={favoriteLabel} title={favorite.error ?? message ?? favoriteLabel} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
      {favorite.busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className={`w-5 h-5 ${favorite.saved ? "fill-[#FF5A5F] text-[#FF5A5F]" : "text-gray-500"}`} />}
    </button>
    <button type="button" onClick={share} aria-label={t("headerActions.shareLabel")} title={t("headerActions.share")} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><Share2 className="w-5 h-5 text-gray-500" /></button>
    {message && <span role="status" className="absolute -bottom-6 right-0 whitespace-nowrap text-xs text-gray-600">{message}</span>}
  </div>;
}
