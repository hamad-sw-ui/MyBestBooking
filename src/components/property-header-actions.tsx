"use client";

import { useState } from "react";
import { Heart, Loader2, Share2 } from "lucide-react";

/** Actions réelles de fiche : favori API et partage Web Share/clipboard. */
export function PropertyHeaderActions({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const [favorite, setFavorite] = useState<"idle" | "busy" | "saved">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function addFavorite() {
    if (favorite === "busy" || favorite === "saved") return;
    setFavorite("busy"); setMessage(null);
    try {
      const lists = await fetch("/api/wishlists");
      if (lists.status === 401) { window.location.href = "/connexion?next=" + encodeURIComponent(window.location.pathname); return; }
      const body = await lists.json();
      let list = body.wishlists?.[0];
      if (!list) {
        const created = await fetch("/api/wishlists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Mes favoris" }) });
        if (!created.ok) throw new Error("Impossible de créer les favoris");
        list = (await created.json()).wishlist;
      }
      const response = await fetch("/api/wishlists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wishlistId: list.id, propertyId }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && !String(result.error).includes("déjà")) throw new Error(result.error ?? "Impossible d'ajouter le favori");
      setFavorite("saved"); setMessage("Ajouté à vos favoris");
    } catch (error) { setFavorite("idle"); setMessage(error instanceof Error ? error.message : "Erreur"); }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: propertyName, url });
      else { await navigator.clipboard.writeText(url); setMessage("Lien copié"); }
    } catch { /* annulation partage : aucune erreur visible */ }
  }

  return <div className="flex items-center gap-2 relative">
    <button type="button" onClick={addFavorite} aria-label="Ajouter aux favoris" title={message ?? "Ajouter aux favoris"} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
      {favorite === "busy" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className={`w-5 h-5 ${favorite === "saved" ? "fill-[#FF5A5F] text-[#FF5A5F]" : "text-gray-500"}`} />}
    </button>
    <button type="button" onClick={share} aria-label="Partager cet hébergement" title="Partager" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><Share2 className="w-5 h-5 text-gray-500" /></button>
    {message && <span role="status" className="absolute -bottom-6 right-0 whitespace-nowrap text-xs text-gray-600">{message}</span>}
  </div>;
}
