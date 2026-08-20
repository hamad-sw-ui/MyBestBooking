import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { conversations, messages, properties, users, bookings } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { MessageSquare, Search, Send, Clock, User } from "lucide-react";

async function getHostConversations(userId: string) {
  // Get host properties
  const hostProperties = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(eq(properties.hostId, userId));

  if (hostProperties.length === 0) return [];

  const result = await db
    .select({
      conversation: conversations,
      property: { name: properties.name, city: properties.city },
      guest: { firstName: users.firstName, lastName: users.lastName, email: users.email },
      booking: { bookingReference: bookings.bookingReference },
    })
    .from(conversations)
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .leftJoin(users, eq(conversations.userId, users.id))
    .leftJoin(bookings, eq(conversations.bookingId, bookings.id))
    .where(or(...hostProperties.map(p => eq(conversations.propertyId, p.id))))
    .orderBy(desc(conversations.lastMessageAt));

  return result;
}

export default async function DashboardMessagesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const hostConversations = user.role === "admin" ? [] : await getHostConversations(user.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Messages
          </h1>
          <p className="text-gray-600 mt-1">
            Communiquez avec vos voyageurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Non lus</p>
            <p className="text-2xl font-bold text-[#FF5A5F]">
              {hostConversations.filter(c => (c.conversation.unreadByHost || 0) > 0).length}
            </p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Total conversations</p>
            <p className="text-2xl font-bold">{hostConversations.length}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Temps de réponse</p>
            <p className="text-2xl font-bold text-green-600">&lt; 2h</p>
          </CardContent>
        </Card>
      </div>

      <Card padding="none">
        {hostConversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-8 h-8" />}
            title="Aucune conversation"
            description="Les messages de vos voyageurs apparaîtront ici"
            className="py-16"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {hostConversations.map(({ conversation, property, guest, booking }) => {
              const unread = (conversation.unreadByHost || 0) > 0;
              return (
                <div
                  key={conversation.id}
                  className={`flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer ${unread ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white font-medium flex-shrink-0">
                    {guest?.firstName?.charAt(0)}{guest?.lastName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium truncate ${unread ? 'text-gray-900' : 'text-gray-700'}`}>
                        {guest?.firstName} {guest?.lastName}
                      </p>
                      {unread && (
                        <Badge variant="info" className="text-xs">
                          {conversation.unreadByHost}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {property?.name} • Réf. {booking?.bookingReference}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">
                      {conversation.lastMessageAt && formatDate(conversation.lastMessageAt, { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Tips */}
      <Card className="mt-6 bg-green-50 border-green-200">
        <CardContent className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900">Temps de réponse</h3>
            <p className="text-sm text-green-700 mt-1">
              Répondez rapidement à vos voyageurs ! Un temps de réponse inférieur à 2 heures
              améliore votre score de fiche et votre visibilité sur mybestbooking.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
