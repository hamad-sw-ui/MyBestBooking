import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { conversations, messages, properties, users } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { MessageComposer } from "@/components/message-composer";
import { MessageAttachment } from "@/components/message-attachment";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, User } from "lucide-react";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const { id } = await params;
  // T-124 (E2) : un identifiant mal formé faisait lever une erreur Postgres
  // 22P02 (journalisée) avant d'atteindre notFound(). On renvoie 404 proprement.
  if (!isUuid(id)) notFound();

  // Charge la conversation avec property + host
  const [row] = await db
    .select({
      conv: conversations,
      property: properties,
    })
    .from(conversations)
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .where(eq(conversations.id, id))
    .limit(1);

  if (!row) notFound();
  const isGuest = row.conv.userId === user.id;
  const isHost = row.property?.hostId === user.id;
  if (!isGuest && !isHost) redirect("/messages");
  const t = makeT(await getServerLocale());

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  // Reset unread côté lecteur
  await db
    .update(conversations)
    .set(isGuest ? { unreadByUser: 0 } : { unreadByHost: 0 })
    .where(eq(conversations.id, id));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/messages"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#1B3A6B] mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("messages.back")}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {row.property?.name ?? t("messages.conversation")}
        </h1>
        <p className="text-sm text-gray-500">
          {row.property?.city}, {row.property?.country}
        </p>
      </div>

      <div className="space-y-3 mb-6 min-h-[200px]">
        {msgs.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            {t("messages.emptyThread")}
          </p>
        )}
        {msgs.map((m) => {
          const mine =
            (isGuest && m.senderType === "user") ||
            (isHost && m.senderType === "host");
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-md rounded-2xl px-4 py-2 ${
                  mine
                    ? "bg-[#1B3A6B] text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                {(m.attachmentKey || m.attachmentUrl) && <MessageAttachment messageId={m.id} legacyUrl={m.attachmentUrl} />}
                <p className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-gray-500"}`}>
                  {formatDate(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <MessageComposer conversationId={id} />
      </div>
    </div>
  );
}
