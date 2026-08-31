"use client";

import { useEffect, useState } from "react";
import { makeT } from "@/lib/ui-strings";
import { useDisplayPreferences } from "@/lib/use-display-currency";

/**
 * <UnreadMessagesBadge /> (T-130) — pastille « messages non lus » pour la
 * navigation. Réutilise GET /api/conversations (déjà filtré par participant)
 * et additionne le compteur non-lu du point de vue de l'utilisateur courant :
 * unreadByHost pour un hôte (sur les conversations de ses biens),
 * unreadByUser pour un voyageur. Additif et silencieux si non connecté ou en
 * erreur : ne casse jamais la navigation.
 */
export function UnreadMessagesBadge({ viewerRole, userId }: { viewerRole?: string; userId?: string }) {
  const [count, setCount] = useState(0);
  const { language } = useDisplayPreferences();
  const t = makeT(language);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/conversations", { cache: "no-store" });
        if (!res.ok) return; // 401 anonyme ou autre : pas de badge
        const data = await res.json();
        const convs = Array.isArray(data?.conversations) ? data.conversations : [];
        let total = 0;
        for (const c of convs) {
          const hostId = c?.property?.hostId ?? null;
          const conv = c?.conversation ?? c;
          // Un hôte consulte les conversations de ses biens ; un voyageur les
          // siennes. On choisit le compteur selon que l'utilisateur est
          // l'hôte de la propriété sous-jacente.
          const isHostView = Boolean(userId && hostId && hostId === userId);
          total += isHostView
            ? Number(conv?.unreadByHost ?? 0)
            : Number(conv?.unreadByUser ?? 0);
        }
        if (!cancelled) setCount(total);
      } catch {
        // silencieux : la navigation doit rester fonctionnelle
      }
    }
    void load();
    // Rafraîchit périodiquement (pas de push temps réel en V1).
    const interval = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [userId, viewerRole]);

  if (count <= 0) return null;
  return (
    <span
      aria-label={t(count > 1 ? "nav.unreadMany" : "nav.unreadOne").replace("{n}", String(count))}
      className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
