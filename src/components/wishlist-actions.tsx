"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Share2, Trash2, Check, Loader2 } from "lucide-react";

interface Props {
  wishlistId: string;
  isPublic: boolean;
  shareToken: string | null;
}

/**
 * <WishlistActions /> (T-031)
 * Actions client pour une liste de favoris :
 * - Partager (copie l'URL /wishlists/share/[token] si publique)
 * - Supprimer la liste entière (DELETE /api/wishlists?wishlistId=)
 */
export function WishlistActions({ wishlistId, isPublic, shareToken }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPublicState, setIsPublicState] = useState(isPublic);
  const [shareTokenState, setShareTokenState] = useState(shareToken);
  const [updatingShare, setUpdatingShare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    if (!isPublicState || !shareTokenState) return;
    const url = `${window.location.origin}/wishlists/share/${shareTokenState}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencieux
    }
  }

  async function updateSharing(nextPublic: boolean, rotateShareToken = false) {
    setError(null);
    setUpdatingShare(true);
    try {
      const response = await fetch("/api/wishlists", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wishlistId, isPublic: nextPublic, rotateShareToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Impossible de modifier le partage");
      setIsPublicState(Boolean(data.wishlist?.isPublic));
      setShareTokenState(data.wishlist?.shareToken ?? null);
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Erreur");
    } finally {
      setUpdatingShare(false);
    }
  }

  function del() {
    if (!confirm("Supprimer cette liste et tous ses favoris ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/wishlists?wishlistId=${wishlistId}`, {
          method: "DELETE",
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? "Erreur");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {isPublicState && shareTokenState ? (
        <>
          <Button variant="ghost" size="sm" onClick={share} aria-label="Copier le lien de partage">
            {copied ? <><Check className="w-4 h-4 mr-2" /> Copié !</> : <><Share2 className="w-4 h-4 mr-2" /> Partager</>}
          </Button>
          <Button variant="ghost" size="sm" disabled={updatingShare} onClick={() => updateSharing(true, true)}>
            Nouveau lien
          </Button>
          <Button variant="ghost" size="sm" disabled={updatingShare} onClick={() => updateSharing(false)}>
            Rendre privée
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" disabled={updatingShare} onClick={() => updateSharing(true)}>
          <Share2 className="w-4 h-4 mr-2" /> Rendre publique
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={del}
        disabled={isPending}
        aria-label="Supprimer la liste"
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </Button>
      {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
    </div>
  );
}
