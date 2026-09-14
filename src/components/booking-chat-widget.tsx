"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";
import { MessageAttachment } from "@/components/message-attachment";
import { MessageComposer } from "@/components/message-composer";

interface ChatMessage {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
  attachmentKey?: string | null;
  attachmentUrl?: string | null;
}

interface Props {
  /** Réservation à laquelle rattacher le fil ; absent pour une première prise de contact. */
  bookingId?: string;
  bookingReference?: string;
  propertyId: string;
  onClose: () => void;
}

/**
 * Chat compact voyageur ↔ hébergeur depuis la partie publique.
 *
 * Avec une réservation, le fil est rattaché à celle-ci : le POST idempotent
 * ouvre ou retrouve `booking:<bookingId>`. Sur une fiche avant réservation, le
 * même composant utilise la clé propriété/voyageur déjà prévue par l'API.
 * Dans les deux cas, les endpoints sécurisés de `/messages/[id]` servent les
 * messages. Le rafraîchissement périodique permet au voyageur de voir une
 * réponse de l'hôte sans changer de page ; l'hôte répond depuis son dashboard.
 */
export function BookingChatWidget({ bookingId, bookingReference, propertyId, onClose }: Props) {
  const t = useT();
  const title = bookingId ? t("book.writeHost") : t("contact.host");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const requestVersion = useRef(0);

  const loadMessages = useCallback(async (id: string, background = false) => {
    if (background) setRefreshing(true);
    try {
      const response = await fetch(`/api/messages?conversationId=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? t("settings.error"));
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.error"));
    } finally {
      if (background) setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    const version = ++requestVersion.current;

    async function openConversation() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(bookingId ? { propertyId, bookingId } : { propertyId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? t("book.openConvFail"));
        const id = data.conversation?.id;
        if (!id) throw new Error(t("contact.notFound"));
        if (cancelled || version !== requestVersion.current) return;
        setConversationId(id);
        await loadMessages(id);
      } catch (reason) {
        if (!cancelled && version === requestVersion.current) {
          setError(reason instanceof Error ? reason.message : t("settings.error"));
        }
      } finally {
        if (!cancelled && version === requestVersion.current) setLoading(false);
      }
    }

    void openConversation();
    return () => {
      cancelled = true;
    };
  }, [bookingId, loadMessages, propertyId, t]);

  useEffect(() => {
    if (!conversationId) return;
    const interval = window.setInterval(() => {
      void loadMessages(conversationId, true);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [conversationId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section
      aria-label={title}
      className="fixed bottom-4 left-4 z-[70] flex w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:bottom-6 sm:left-6"
    >
      <header className="flex items-center justify-between bg-[#1B3A6B] px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            {bookingReference ? (
              <p className="truncate text-xs text-white/75">
                {t("bookings.ref")} {bookingReference}
              </p>
            ) : (
              <p className="truncate text-xs text-white/75">{t("contact.question")}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("action.close")}
          className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div
        aria-live="polite"
        className="max-h-[min(55vh,26rem)] min-h-[12rem] space-y-3 overflow-y-auto bg-gray-50 px-3 py-3"
      >
        {loading && (
          <div className="flex h-40 items-center justify-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            {t("loading.label")}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => conversationId && void loadMessages(conversationId)}
              className="mt-2 inline-flex items-center gap-1 font-medium underline"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {t("error.retry")}
            </button>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-500">
            {t("messages.emptyThread")}
          </p>
        )}

        {!loading && messages.map((message) => {
          const mine = message.senderType === "user";
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                  mine ? "bg-[#1B3A6B] text-white" : "bg-white text-gray-900 shadow-sm"
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                {(message.attachmentKey || message.attachmentUrl) && (
                  <MessageAttachment messageId={message.id} legacyUrl={message.attachmentUrl} />
                )}
                <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-gray-500"}`}>
                  {new Date(message.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 bg-white px-3 py-3">
        {refreshing && (
          <p className="mb-1 flex items-center gap-1 text-[11px] text-gray-400">
            <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t("loading.label")}
          </p>
        )}
        {conversationId && (
          <MessageComposer
            conversationId={conversationId}
            onSent={() => loadMessages(conversationId)}
          />
        )}
      </div>
    </section>
  );
}
