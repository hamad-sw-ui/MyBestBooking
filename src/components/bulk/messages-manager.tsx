"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageSquare, Search, X, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";

/**
 * <MessagesManager> (T-034) — dashboard `/dashboard/messages` avec :
 *   - Recherche client sur nom voyageur, hébergement, référence de résa
 *   - Filtre lu / non lu / tous
 *   - Raccourci clavier `/` pour focus, Escape pour vider
 *   - Pas de bulk (les conversations ne sont pas mutables par admin en V1)
 */

export interface ConversationRow {
  conversation: {
    id: string;
    lastMessageAt: string | null;
    unreadByHost: number | null;
  };
  property: {
    name: string | null;
    city: string | null;
  } | null;
  guest: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  booking: {
    bookingReference: string | null;
  } | null;
}

interface Props {
  conversations: ConversationRow[];
}

export function MessagesManager({ conversations }: Props) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);

  // Raccourcis clavier locaux (calqués sur BulkToolbar)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (e.key === "/" && !inField) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        if (document.activeElement === searchRef.current) {
          searchRef.current?.blur();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return conversations.filter((c) => {
      const unread = (c.conversation.unreadByHost ?? 0) > 0;
      if (statusFilter === "unread" && !unread) return false;
      if (statusFilter === "read" && unread) return false;
      if (!ql) return true;
      const first = c.guest?.firstName ?? "";
      const last = c.guest?.lastName ?? "";
      const email = c.guest?.email ?? "";
      const prop = c.property?.name ?? "";
      const city = c.property?.city ?? "";
      const ref = c.booking?.bookingReference ?? "";
      return (
        first.toLowerCase().includes(ql) ||
        last.toLowerCase().includes(ql) ||
        email.toLowerCase().includes(ql) ||
        prop.toLowerCase().includes(ql) ||
        city.toLowerCase().includes(ql) ||
        ref.toLowerCase().includes(ql)
      );
    });
  }, [conversations, q, statusFilter]);

  const stats = {
    unread: conversations.filter(
      (c) => (c.conversation.unreadByHost ?? 0) > 0,
    ).length,
    total: conversations.length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Messages
          </h1>
          <p className="text-gray-600 mt-1">Communiquez avec vos voyageurs</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Rechercher <span className="text-gray-400">(tapez « / »)</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, email, hébergement, référence…"
              className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Filtrer
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none bg-white"
          >
            <option value="all">Toutes</option>
            <option value="unread">Non lues</option>
            <option value="read">Lues</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card padding="sm">
          <div className="p-4">
            <p className="text-sm text-gray-500">Non lus</p>
            <p className="text-2xl font-bold text-[#FF5A5F]">{stats.unread}</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="p-4">
            <p className="text-sm text-gray-500">Total conversations</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="p-4">
            <p className="text-sm text-gray-500">Temps de réponse</p>
            <p className="text-2xl font-bold text-green-600">&lt; 2h</p>
          </div>
        </Card>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        {filtered.length} conversation{filtered.length > 1 ? "s" : ""} affichée
        {filtered.length > 1 ? "s" : ""}
        {filtered.length !== conversations.length &&
          ` sur ${conversations.length}`}
      </p>

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-8 h-8" />}
            title="Aucune conversation"
            description="Les messages de vos voyageurs apparaîtront ici (ou ajustez vos filtres)."
            className="py-16"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(({ conversation, property, guest, booking }) => {
              const unread = (conversation.unreadByHost ?? 0) > 0;
              return (
                <div
                  key={conversation.id}
                  className={`flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer ${
                    unread ? "bg-blue-50/50" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white font-medium flex-shrink-0">
                    {guest?.firstName?.charAt(0) ?? "?"}
                    {guest?.lastName?.charAt(0) ?? ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`font-medium truncate ${
                          unread ? "text-gray-900" : "text-gray-700"
                        }`}
                      >
                        {guest?.firstName ?? "?"} {guest?.lastName ?? ""}
                      </p>
                      {unread && (
                        <Badge variant="info" className="text-xs">
                          {conversation.unreadByHost}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {property?.name ?? "—"} · Réf.{" "}
                      {booking?.bookingReference ?? "—"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">
                      {conversation.lastMessageAt &&
                        formatDate(conversation.lastMessageAt, {
                          day: "numeric",
                          month: "short",
                        })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mt-6 bg-green-50 border-green-200">
        <div className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900">Temps de réponse</h3>
            <p className="text-sm text-green-700 mt-1">
              Répondez rapidement à vos voyageurs ! Un temps de réponse
              inférieur à 2 heures améliore votre score de fiche et votre
              visibilité sur mybestbooking.
            </p>
          </div>
        </div>
      </Card>

      <p className="text-xs text-gray-400 mt-3">
        Raccourcis : <kbd className="px-1 bg-gray-100 rounded">/</kbd> chercher ·{" "}
        <kbd className="px-1 bg-gray-100 rounded">Échap</kbd> quitter
      </p>
    </div>
  );
}
