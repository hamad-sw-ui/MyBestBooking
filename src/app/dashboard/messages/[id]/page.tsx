import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { conversations, messages, properties, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { MessageComposer } from "@/components/message-composer";
import { MessageAttachment } from "@/components/message-attachment";
import { formatDate } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export const dynamic = "force-dynamic";

export default async function DashboardConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const t = makeT(await getServerLocale());
  if (!user) redirect("/connexion");
  if (user.role !== "host" && user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  // T-124 (E2) : identifiant mal formé → 404 propre (pas d'erreur Postgres 22P02).
  if (!isUuid(id)) notFound();

  const [row] = await db
    .select({
      conv: conversations,
      property: properties,
      guest: {
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(conversations)
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .leftJoin(users, eq(conversations.userId, users.id))
    .where(eq(conversations.id, id))
    .limit(1);

  if (!row) notFound();
  const isHostOwner = row.property?.hostId === user.id;
  const isAdmin = user.role === "admin";
  if (!isHostOwner && !isAdmin) redirect("/dashboard/messages");

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  await db
    .update(conversations)
    .set({ unreadByHost: 0 })
    .where(eq(conversations.id, id));

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/dashboard/messages"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#1B3A6B] mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("dash.backConversations")}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("dash.convWith").replace("{name}", `${row.guest?.firstName ?? ""} ${row.guest?.lastName ?? ""}`.trim())}
        </h1>
        <p className="text-sm text-gray-500">
          {t("dash.aboutOf").replace("{name}", row.property?.name ?? "")}
        </p>
      </div>

      <div className="space-y-3 mb-6 min-h-[200px]">
        {msgs.length === 0 && (
          <p className="text-center text-gray-500 py-12">{t("messages.noMessageYet")}</p>
        )}
        {msgs.map((m) => {
          const mine = m.senderType === "host";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-md rounded-2xl px-4 py-2 ${
                  mine ? "bg-[#1B3A6B] text-white" : "bg-gray-100 text-gray-900"
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
