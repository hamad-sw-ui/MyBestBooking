import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import {
  conversations,
  properties,
  users,
  bookings,
  messages,
} from "@/db/schema";
import { and, count, eq, desc, inArray, sql } from "drizzle-orm";
import {
  MessagesManager,
  type ConversationRow,
} from "@/components/bulk/messages-manager";
import { ShowMore } from "@/components/ui/show-more";
import { parsePageWindow } from "@/lib/page-window";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

/**
 * /dashboard/messages (refactoré T-034) — Server Component minimaliste
 * qui délègue au <MessagesManager> client (recherche + filtre lu/non-lu).
 *
 * T-257 (audit n°6, B4) : c'était le dernier écran de liste sans fenêtre —
 * toutes les conversations de l'hôte (ou de la plateforme pour un admin)
 * étaient chargées d'un coup. `parsePageWindow` + `<ShowMore>` appliquent le
 * même contrat que les 7 autres écrans (T-245) et le filtre « fils non vides »
 * (T-206/F9) ainsi que la portée par bien sont partagés entre la liste et le
 * compteur pour que « N sur M » soit exact.
 */

interface MessageScope {
  isAdmin: boolean;
  hostPropertyIds: string[];
}

function conversationScope(scope: MessageScope) {
  const nonEmpty = sql`EXISTS (SELECT 1 FROM ${messages} msg WHERE msg.conversation_id = ${conversations.id})`;
  // T-206/F9 : les fils vides restent masqués. Un hôte ne voit que les
  // conversations de ses biens (liste de propriétés vide = aucun résultat).
  return scope.isAdmin
    ? and(nonEmpty)
    : and(nonEmpty, inArray(conversations.propertyId, scope.hostPropertyIds));
}

async function getDashboardConversations(scope: MessageScope, limit: number): Promise<ConversationRow[]> {
  if (!scope.isAdmin && scope.hostPropertyIds.length === 0) return [];

  const result = await db
    .select({
      conversation: conversations,
      property: { name: properties.name, city: properties.city },
      guest: {
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
      booking: { bookingReference: bookings.bookingReference },
    })
    .from(conversations)
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .leftJoin(users, eq(conversations.userId, users.id))
    .leftJoin(bookings, eq(conversations.bookingId, bookings.id))
    .where(conversationScope(scope))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit);

  return result.map((r) => ({
    conversation: {
      id: r.conversation.id,
      lastMessageAt: r.conversation.lastMessageAt
        ? r.conversation.lastMessageAt.toISOString()
        : null,
      unreadByHost: r.conversation.unreadByHost,
    },
    property: r.property
      ? { name: r.property.name ?? null, city: r.property.city ?? null }
      : null,
    guest: r.guest
      ? {
          firstName: r.guest.firstName ?? null,
          lastName: r.guest.lastName ?? null,
          email: r.guest.email ?? null,
        }
      : null,
    booking: r.booking
      ? { bookingReference: r.booking.bookingReference ?? null }
      : null,
  }));
}

async function countDashboardConversations(scope: MessageScope): Promise<number> {
  if (!scope.isAdmin && scope.hostPropertyIds.length === 0) return 0;
  const [row] = await db
    .select({ total: count() })
    .from(conversations)
    .where(conversationScope(scope));
  return row?.total ?? 0;
}

export default async function DashboardMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const t = makeT(await getServerLocale());
  const window = parsePageWindow((await searchParams).limit);

  const hostPropertyIds = isAdmin
    ? []
    : (
        await db
          .select({ id: properties.id })
          .from(properties)
          .where(eq(properties.hostId, user.id))
      ).map((row) => row.id);
  const scope: MessageScope = { isAdmin, hostPropertyIds };

  const [rows, total] = await Promise.all([
    getDashboardConversations(scope, window.queryLimit),
    countDashboardConversations(scope),
  ]);
  const visible = rows.slice(0, window.size);

  return (
    <div>
      <MessagesManager conversations={visible} />
      <ShowMore
        shown={visible.length}
        total={total}
        hasMore={rows.length > visible.length}
        basePath="/dashboard/messages"
        params={{}}
        labels={{
          shown: t("list.window.shown"),
          showMore: t("list.window.showMore"),
          showAll: t("list.window.showAll"),
          limitReached: t("list.window.limitReached"),
          filterScope: t("list.window.filterScope"),
        }}
      />
    </div>
  );
}
