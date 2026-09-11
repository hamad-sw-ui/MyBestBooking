import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { conversations, messages, properties, users, bookings } from "@/db/schema";
import { eq, desc, or, and, inArray, count, sql, ilike } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { MessageSquare, Search, Send, Building2, Calendar } from "lucide-react";
import Link from "next/link";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { SmartImage } from "@/components/ui/smart-image";
import { isConversationVisible, EMPTY_THREAD_VISIBLE_DAYS } from "@/lib/conversation-visibility";
import { ShowMore } from "@/components/ui/show-more";
import { parsePageWindow } from "@/lib/page-window";

/**
 * T-172 — titre localisé + noindex (messagerie privée, non indexable).
 */
export async function generateMetadata() {
  const t = makeT(await getServerLocale());
  return {
    title: t("messages.meta.title"),
    robots: { index: false, follow: false },
  };
}

/**
 * T-270 (audit n°7, C6) — périmètre « conversation visible » en SQL, IDENTIQUE
 * à la règle JS T-217/P7 (`isConversationVisible`) : au moins un message, OU
 * fil vide créé depuis moins de 7 jours. La liste et le compteur partagent
 * exactement la même condition (visibilité + recherche) : le bandeau
 * « N sur M » ne peut pas mentir (contrat T-257).
 */
function conversationConditions(userId: string, needle?: string) {
  const participant = or(
    eq(conversations.userId, userId),
    eq(properties.hostId, userId)
  );
  const visible = sql`(
    EXISTS (SELECT 1 FROM ${messages} m WHERE m.conversation_id = ${conversations.id})
    OR ${conversations.createdAt} > (now() - (${EMPTY_THREAD_VISIBLE_DAYS} || ' days')::interval)
  )`;
  if (!needle) return and(participant, visible);
  // Miroir SQL du filtre JS de recherche : nom/ville de l'hébergement, ou
  // contenu du DERNIER message du fil.
  const search = or(
    ilike(properties.name, `%${needle}%`),
    ilike(properties.city, `%${needle}%`),
    sql`EXISTS (
      SELECT 1 FROM ${messages} m
      WHERE m.conversation_id = ${conversations.id}
        AND m.content ILIKE ${`%${needle}%`}
        AND m.created_at = (
          SELECT max(m2.created_at) FROM ${messages} m2
          WHERE m2.conversation_id = ${conversations.id}
        )
    )`
  );
  return and(participant, visible, search);
}

async function getConversations(userId: string, search: string, limit: number) {
  const rows = await db
    .select({
      conversation: conversations,
      property: {
        id: properties.id,
        name: properties.name,
        city: properties.city,
        mainImage: properties.mainImage,
        hostId: properties.hostId,
      },
      booking: {
        id: bookings.id,
        bookingReference: bookings.bookingReference,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
      },
    })
    .from(conversations)
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .leftJoin(bookings, eq(conversations.bookingId, bookings.id))
    .where(conversationConditions(userId, needleOf(search)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit);

  // Dernier message des fils chargés, en UNE requête (l'ancien 1 + N : une
  // requête par conversation, est remplacé). Premier message par fil dans le
  // tri `createdAt desc` = le plus récent.
  const convIds = rows.map((r) => r.conversation.id).filter(Boolean);
  const lastMessages = new Map<string, { content: string; senderType: string; createdAt: Date } | null>();
  for (const id of convIds) lastMessages.set(id, null);
  if (convIds.length > 0) {
    const loaded = await db
      .select({
        conversationId: messages.conversationId,
        content: messages.content,
        senderType: messages.senderType,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, convIds))
      .orderBy(desc(messages.createdAt));
    for (const m of loaded) {
      if (lastMessages.get(m.conversationId) === null) {
        lastMessages.set(m.conversationId, {
          content: m.content,
          senderType: m.senderType,
          createdAt: m.createdAt,
        });
      }
    }
  }

  const conversationsWithMessages = rows.map((conv) => ({
    ...conv,
    lastMessage: lastMessages.get(conv.conversation.id) ?? null,
  }));

  // Garde-fou JS (règle pure, inchangée) : même sémantique que le filtre SQL.
  const visibleConversations = conversationsWithMessages.filter(({ conversation, lastMessage }) =>
    isConversationVisible({ hasMessage: Boolean(lastMessage), createdAt: conversation.createdAt }),
  );
  const needle = search.trim().toLocaleLowerCase("fr");
  if (!needle) return visibleConversations;
  return visibleConversations.filter(({ property, lastMessage }) =>
    [property?.name, property?.city, lastMessage?.content]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase("fr").includes(needle)),
  );
}

/** Aiguille de recherche (trim + minuscules) ; `undefined` si vide. */
function needleOf(search: string): string | undefined {
  const n = search.trim().toLocaleLowerCase("fr");
  return n || undefined;
}

async function countVisibleConversations(userId: string, search: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(conversations)
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .where(conversationConditions(userId, needleOf(search)));
  return row?.total ?? 0;
}

/**
 * T-270 (audit n°7, C6) : fenêtre de chargement (contrat T-245, 9ᵉ écran
 * rattrapé) — 25 fils par défaut, « Afficher 25 de plus », plafond 500.
 * La fenêtre borne le **chargement** : la recherche porte sur la fenêtre
 * affichée (comme les autres écrans), et le compteur total est calculé avec
 * la MÊME condition de visibilité que la liste.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; limit?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/connexion");
  }

  const { search = "", limit } = await searchParams;
  const window = parsePageWindow(limit);
  const [loaded, total] = await Promise.all([
    getConversations(user.id, search, window.queryLimit),
    countVisibleConversations(user.id, search),
  ]);
  const userConversations = loaded.slice(0, window.size);
  const locale = await getServerLocale();
  const t = makeT(locale);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {t("messages.title")}
          </h1>
          <p className="text-gray-600 mt-1">
            {t("messages.subtitle")}
          </p>
        </div>

        {/* Search */}
        <form method="get" action="/messages" className="mb-6">
          <label className="sr-only" htmlFor="messages-search">{t("messages.searchLabel")}</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="messages-search"
              type="search"
              name="search"
              defaultValue={search}
              placeholder={t("messages.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            />
          </div>
        </form>

        {userConversations.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MessageSquare className="w-8 h-8" />}
              title={t("messages.emptyTitle")}
              description={t("messages.empty")}
              action={
                <Link href="/recherche">
                  <Button>{t("messages.findProperty")}</Button>
                </Link>
              }
              className="py-16"
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {userConversations.map(({ conversation, property, booking, lastMessage }) => {
              const isHost = property?.hostId === user.id;
              const unreadCount = isHost ? conversation.unreadByHost : conversation.unreadByUser;

              return (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="block"
                >
                  <Card className={`hover:shadow-md transition-shadow ${unreadCount && unreadCount > 0 ? 'border-[#1B3A6B]' : ''}`}>
                    <CardContent className="flex items-start gap-4">
                      {/* Property Image */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
                        {property?.mainImage ? (
                          <SmartImage
                            src={property.mainImage}
                            alt={property.name || ""}
                            className="w-full h-full object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {property?.name}
                            </h3>
                            <p className="text-sm text-gray-500">{property?.city}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-gray-400">
                              {formatDate(lastMessage?.createdAt ?? conversation.createdAt, { day: "numeric", month: "short" }, locale)}
                            </p>
                            {unreadCount && unreadCount > 0 && (
                              <Badge variant="info" className="mt-1">
                                {(unreadCount > 1 ? t("messages.unreadMany") : t("messages.unreadOne")).replace("{n}", String(unreadCount))}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Booking info */}
                        {booking && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>{t("bookings.ref")} {booking.bookingReference}</span>
                            <span>•</span>
                            <span>
                              {formatDate(booking.checkIn, { day: "numeric", month: "short" }, locale)} - {formatDate(booking.checkOut, { day: "numeric", month: "short" }, locale)}
                            </span>
                          </div>
                        )}

                        {/* Last message preview — un fil vide récent affiche
                            son état « brouillon » (T-217/P7). */}
                        {lastMessage ? (
                          <p className="mt-2 text-sm text-gray-600 truncate">
                            {lastMessage.senderType === "user" && !isHost && t("messages.youPrefix")}
                            {lastMessage.senderType === "host" && isHost && t("messages.youPrefix")}
                            {lastMessage.content}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-gray-400 italic truncate">
                            {t("messages.draftPreview")}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* T-270 : la fenêtre borne le chargement ; le bandeau porte le total
            VISIBLE (même condition SQL que la liste) et conserve la recherche. */}
        <ShowMore
          shown={userConversations.length}
          total={total}
          hasMore={loaded.length > userConversations.length}
          basePath="/messages"
          params={{ search: search || undefined }}
          labels={{
            shown: t("list.window.shown"),
            showMore: t("list.window.showMore"),
            showAll: t("list.window.showAll"),
            limitReached: t("list.window.limitReached"),
            filterScope: t("list.window.filterScope"),
          }}
        />

        {/* Help */}
        <Card className="mt-8 bg-gray-50">
          <CardContent className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t("messages.needHelp")}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {t("messages.needHelpBody")}
              </p>
              <a
                href="mailto:support@mybestbooking.com?subject=Aide%20MyBestBooking"
                className="inline-flex items-center mt-3 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition"
              >
                {t("messages.contactSupport")}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
