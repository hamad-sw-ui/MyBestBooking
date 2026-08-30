"use client";

import { useState } from "react";
import { ThumbsUp } from "lucide-react";

export function ReviewHelpfulButton({
  reviewId,
  initialCount,
  isOwn = false,
}: {
  reviewId: string;
  initialCount: number | null;
  /** T-136 : masqué sur l'avis de l'utilisateur connecté (pas d'auto-vote). */
  isOwn?: boolean;
}) {
  const [count, setCount] = useState(initialCount ?? 0);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function vote() {
    if (state !== "idle") return;
    setState("sending");
    try {
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Erreur");
      setCount(body.review?.helpfulCount ?? count + 1);
      setState("done");
    } catch {
      setState("error");
    }
  }

  // T-136 : l'auteur ne peut pas voter sur son propre avis. Le serveur rejette
  // aussi la requête (400) ; on masque le bouton pour ne pas le proposer.
  if (isOwn) return null;

  return (
    <button type="button" onClick={vote} disabled={state === "sending" || state === "done"} className="mt-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#1B3A6B] disabled:opacity-60">
      <ThumbsUp className="w-3.5 h-3.5" />
      {state === "done" ? "Merci" : "Utile"} ({count})
      {state === "error" && <span className="text-red-600"> — connexion requise</span>}
    </button>
  );
}
