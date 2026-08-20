"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Paperclip, X as XIcon } from "lucide-react";

interface Props {
  conversationId: string;
}

/**
 * Composeur de message pour envoyer un message dans une conversation
 * (T-016 + T-029 pièces jointes).
 * POST /api/messages { conversationId, content, attachmentUrl? }
 */
export function MessageComposer({ conversationId }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setAttachmentUrl(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !attachmentUrl) return;
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = { conversationId, content: content.trim() || "(pièce jointe)" };
      if (attachmentUrl) body.attachmentUrl = attachmentUrl;
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setContent("");
      setAttachmentUrl(null);
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
        {attachmentUrl && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <Paperclip className="w-3 h-3" />
            <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Pièce jointe attachée
            </a>
            <button
              type="button"
              onClick={() => setAttachmentUrl(null)}
              aria-label="Retirer la pièce jointe"
              className="text-gray-400 hover:text-red-600"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="msg-attach"
      />
      <label
        htmlFor="msg-attach"
        aria-label="Ajouter une pièce jointe"
        className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer"
        title="Ajouter une pièce jointe"
      >
        <Paperclip className="w-5 h-5 text-gray-600" />
      </label>
      <button
        type="submit"
        disabled={loading || uploading || (content.trim().length === 0 && !attachmentUrl)}
        aria-label="Envoyer le message"
        className="p-3 bg-[#FF5A5F] text-white rounded-lg hover:bg-[#e54a4f] disabled:opacity-50"
      >
        <Send className="w-5 h-5" />
      </button>
    </form>
  );
}
