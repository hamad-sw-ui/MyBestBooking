"use client";

import { useState } from "react";
import { Heart, Loader2, Share2 } from "lucide-react";
import { useWishlistToggle } from "@/lib/use-wishlist-toggle";
// T-154d (audit n°26, P2-8) : confirmation favori via ToastProvider.
import { useToast } from "@/components/ui/toast";

/** Actions réelles de fiche : favori API (ajout + retrait, T-154c/P2-6)
 * et partage Web Share/clipboard. */
export function PropertyHeaderActions({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const favorite = useWishlistToggle(propertyId);
  const { addToast } = useToast();
  const [message, setMessage] = useState<string | null>(null);

  async function toggleFavorite() {
    if (favorite.busy) return;
    const wasSaved = favorite.saved;
    setMessage(null);
    const outcome = await favorite.toggle();
    if (outcome === "unauthenticated") {
      window.location.href = "/connexion?next=" + encodeURIComponent(window.location.pathname);
      return;
    }
    const text = wasSaved ? "Retiré de vos favoris" : "Ajouté à vos favoris";
    setMessage(text);
    addToast(wasSaved ? "info" : "success", text);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: propertyName, url });
      else { await navigator.clipboard.writeText(url); setMessage("Lien copié"); }
    } catch { /* annulation partage : aucune erreur visible */ }
  }

  return <div className="flex items-center gap-2 relative">
    <button type="button" onClick={toggleFavorite} aria-label={favorite.saved ? "Retirer des favoris" : "Ajouter aux favoris"} title={favorite.error ?? message ?? (favorite.saved ? "Retirer des favoris" : "Ajouter aux favoris")} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
      {favorite.busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className={`w-5 h-5 ${favorite.saved ? "fill-[#FF5A5F] text-[#FF5A5F]" : "text-gray-500"}`} />}
    </button>
    <button type="button" onClick={share} aria-label="Partager cet hébergement" title="Partager" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><Share2 className="w-5 h-5 text-gray-500" /></button>
    {message && <span role="status" className="absolute -bottom-6 right-0 whitespace-nowrap text-xs text-gray-600">{message}</span>}
  </div>;
}
