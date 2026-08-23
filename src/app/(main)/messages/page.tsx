import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { conversations, messages, properties, users, bookings } from "@/db/schema";
import { eq, desc, or, and } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { MessageSquare, Search, Send, Building2, Calendar } from "lucide-react";
import Link from "next/link";

async function getConversations(userId: string, search = "") {
  const userConversations = await db
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
    .where(
      or(
        eq(conversations.userId, userId),
        eq(properties.hostId, userId)
      )
    )
    .orderBy(desc(conversations.lastMessageAt));

  // Get last message for each conversation
  const conversationsWithMessages = await Promise.all(
    userConversations.map(async (conv) => {
      const [lastMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.conversation.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return {
        ...conv,
        lastMessage,
      };
    })
  );

  const needle = search.trim().toLocaleLowerCase("fr");
  if (!needle) return conversationsWithMessages;
  return conversationsWithMessages.filter(({ property, lastMessage }) =>
    [property?.name, property?.city, lastMessage?.content]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase("fr").includes(needle)),
  );
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/connexion");
  }

  const { search = "" } = await searchParams;
  const userConversations = await getConversations(user.id, search);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Messages
          </h1>
          <p className="text-gray-600 mt-1">
            Vos conversations avec les hébergeurs
          </p>
        </div>

        {/* Search */}
        <form method="get" action="/messages" className="mb-6">
          <label className="sr-only" htmlFor="messages-search">Rechercher dans les messages</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="messages-search"
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Rechercher dans les messages..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            />
          </div>
        </form>

        {userConversations.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MessageSquare className="w-8 h-8" />}
              title="Aucun message"
              description="Vos conversations avec les hébergeurs apparaîtront ici après une réservation"
              action={
                <Link href="/recherche">
                  <Button>Trouver un hébergement</Button>
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
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {property?.mainImage ? (
                          <img
                            src={property.mainImage}
                            alt={property.name || ""}
                            className="w-full h-full object-cover"
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
                            {lastMessage && (
                              <p className="text-xs text-gray-400">
                                {formatDate(lastMessage.createdAt, { day: "numeric", month: "short" })}
                              </p>
                            )}
                            {unreadCount && unreadCount > 0 && (
                              <Badge variant="info" className="mt-1">
                                {unreadCount} nouveau{unreadCount > 1 ? "x" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Booking info */}
                        {booking && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>Réf. {booking.bookingReference}</span>
                            <span>•</span>
                            <span>
                              {formatDate(booking.checkIn, { day: "numeric", month: "short" })} - {formatDate(booking.checkOut, { day: "numeric", month: "short" })}
                            </span>
                          </div>
                        )}

                        {/* Last message preview */}
                        {lastMessage && (
                          <p className="mt-2 text-sm text-gray-600 truncate">
                            {lastMessage.senderType === "user" && !isHost && "Vous: "}
                            {lastMessage.senderType === "host" && isHost && "Vous: "}
                            {lastMessage.content}
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

        {/* Help */}
        <Card className="mt-8 bg-gray-50">
          <CardContent className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Besoin d&apos;aide ?</h3>
              <p className="text-sm text-gray-600 mt-1">
                Notre équipe support répond par email aux demandes envoyées depuis ce lien.
              </p>
              <a
                href="mailto:support@mybestbooking.com?subject=Aide%20MyBestBooking"
                className="inline-flex items-center mt-3 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition"
              >
                Contacter le support
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
