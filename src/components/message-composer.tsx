"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

interface Props {
  conversationId: string;
}

/**
 * Composeur de message pour envoyer un message dans une conversation
 * (T-016). POST /api/messages
 */
export function MessageComposer({ conversationId }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, content: content.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setContent("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1">
        <label htmlFor="msg-content" className="sr-only">
          Votre message
        </label>
        <textarea
          id="msg-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Écrivez votre message…"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={loading || content.trim().length === 0}
        aria-label="Envoyer le message"
        className="p-3 bg-[#FF5A5F] text-white rounded-lg hover:bg-[#e54a4f] disabled:opacity-50"
      >
        <Send className="w-5 h-5" />
      </button>
    </form>
  );
}
