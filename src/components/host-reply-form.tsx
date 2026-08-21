"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  reviewId: string;
  initialReply?: string | null;
}

/**
 * Formulaire client pour la réponse hôte à un avis (T-016).
 * POST /api/reviews/[id]/reply
 */
export function HostReplyForm({ reviewId, initialReply }: Props) {
  const router = useRouter();
  const [reply, setReply] = useState(initialReply ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reply: reply.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <label className="sr-only" htmlFor={`reply-${reviewId}`}>Votre réponse</label>
      <textarea
        id={`reply-${reviewId}`}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
        maxLength={2000}
        required
        placeholder="Rédigez votre réponse publique à cet avis…"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-gray-500">{reply.length} / 2000</div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">Publiée ✓</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
          <button
            type="submit"
            disabled={loading || reply.trim().length === 0}
            className="px-4 py-2 text-sm bg-[#1B3A6B] text-white rounded-lg hover:bg-[#0f2444] disabled:opacity-50"
          >
            {loading ? "Envoi…" : "Répondre"}
          </button>
        </div>
      </div>
    </form>
  );
}
