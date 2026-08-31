"use client";

import { useT } from "@/components/ui-locale-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2 } from "lucide-react";

/**
 * T-133 (A3) — « Contacter l'hôte » avant réservation.
 *
 * L'API POST /api/conversations supporte déjà une filature voyageur sans
 * réservation (clé `property:<prop>:user:<voyageur>`, idempotente). Ce bouton
 * ne fait que l'exposer : il crée (ou rouvre) la conversation puis redirige
 * vers /messages/[id]. Un visiteur non connecté est renvoyé à la connexion
 * (comme le bouton favoris). L'hôte sur sa propre propriété ne le voit pas
 * (masqué côté serveur via `hidden`).
 */
export function ContactHostButton({ propertyId, className }: { propertyId: string; className?: string }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function contact() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      if (res.status === 401) {
        window.location.assign("/connexion?next=" + encodeURIComponent(window.location.pathname));
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("contact.error"));
      if (data.conversation?.id) router.push(`/messages/${data.conversation.id}`);
      else throw new Error(t("contact.notFound"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.error"));
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={contact}
        disabled={busy}
        title={error ?? t("contact.question")}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#1B3A6B] text-[#1B3A6B] font-medium hover:bg-[#1B3A6B] hover:text-white transition-colors disabled:opacity-50 w-full"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
        {t("contact.host")}
      </button>
      {error && <p role="status" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
