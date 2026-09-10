import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import {
  conversations,
  properties,
  users,
  bookings,
  messages,
} from "@/db/schema";
import { and, eq, desc, or, sql } from "drizzle-orm";
import {
  MessagesManager,
  type ConversationRow,
} from "@/components/bulk/messages-manager";

/**
 * /dashboard/messages (refactoré T-034) — Server Component minimaliste
 * qui délègue au <MessagesManager> client (recherche + filtre lu/non-lu).
 */

async function getDashboardConversations(userId: string, isAdmin: boolean): Promise<ConversationRow[]> {
  const hostProperties = isAdmin
    ? []
    : await db
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .where(eq(properties.hostId, userId));
  if (!isAdmin && hostProperties.length === 0) return [];

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
    .where(and(
      // T-206/F9 : les listes de messagerie n'affichent plus les fils vides.
      sql`EXISTS (SELECT 1 FROM ${messages} msg WHERE msg.conversation_id = ${conversations.id})`,
      ...(isAdmin ? [] : [or(...hostProperties.map((p) => eq(conversations.propertyId, p.id)))!]),
    ))
    .orderBy(desc(conversations.lastMessageAt));

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

export default async function DashboardMessagesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const list = await getDashboardConversations(user.id, user.role === "admin");
  return <MessagesManager conversations={list} />;
}
