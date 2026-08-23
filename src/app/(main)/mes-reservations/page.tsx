import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties, rooms } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, formatDate, getStatusBadgeColor } from "@/lib/utils";
import { Calendar, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { BookingRowActions } from "@/components/booking-row-actions";

async function getMyBookings(userId: string) {
  return db
    .select({
      booking: bookings,
      property: {
        id: properties.id,
        name: properties.name,
        slug: properties.slug,
        city: properties.city,
        country: properties.country,
        mainImage: properties.mainImage,
      },
      room: {
        name: rooms.name,
        roomType: rooms.roomType,
      },
    })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .leftJoin(rooms, eq(bookings.roomId, rooms.id))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.checkIn));
}

export default async function MyBookingsPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/connexion");
  }

  const myBookings = await getMyBookings(user.id);

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    confirmed: "Confirmée",
    cancelled: "Annulée",
    completed: "Terminée",
    no_show: "No-show",
  };

  // Separate upcoming and past bookings
  const today = new Date();
  const upcomingBookings = myBookings.filter(b => new Date(b.booking.checkIn) >= today && b.booking.status !== "cancelled");
  const pastBookings = myBookings.filter(b => new Date(b.booking.checkIn) < today || b.booking.status === "cancelled");

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Mes réservations
          </h1>
          <p className="text-gray-600 mt-1">
            Retrouvez toutes vos réservations mybestbooking
          </p>
        </div>

        {myBookings.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Calendar className="w-8 h-8" />}
              title="Aucune réservation"
              description="Vous n'avez pas encore effectué de réservation. Trouvez votre prochain séjour !"
              action={
                <Link href="/recherche">
                  <Button>Explorer les hébergements</Button>
                </Link>
              }
              className="py-16"
            />
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Upcoming */}
            {upcomingBookings.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  À venir ({upcomingBookings.length})
                </h2>
                <div className="space-y-4">
                  {upcomingBookings.map(({ booking, property, room }) => (
                    <Card key={booking.id} className="overflow-hidden">
                      <div className="flex flex-col md:flex-row">
                        {property?.mainImage && (
                          <div className="md:w-48 h-40 md:h-auto flex-shrink-0">
                            <img
                              src={property.mainImage}
                              alt={property.name || ""}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <Badge className={getStatusBadgeColor(booking.status)}>
                                {statusLabels[booking.status]}
                              </Badge>
                              <h3 className="text-lg font-semibold text-gray-900 mt-2">
                                {property?.name}
                              </h3>
                              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                <MapPin className="w-4 h-4" />
                                {property?.city}, {property?.country}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Réf.</p>
                              <p className="font-mono font-medium text-[#1B3A6B]">
                                {booking.bookingReference}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-gray-100">
                            <div>
                              <p className="text-xs text-gray-500">Arrivée</p>
                              <p className="font-medium">{formatDate(booking.checkIn, { day: "numeric", month: "short" })}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Départ</p>
                              <p className="font-medium">{formatDate(booking.checkOut, { day: "numeric", month: "short" })}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Chambre</p>
                              <p className="font-medium">{room?.name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Total</p>
                              <p className="font-bold text-[#1B3A6B]">{formatPrice(booking.total, booking.currency)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mt-4">
                            <Link href={`/hebergement/${property?.slug}`}>
                              <Button variant="outline" size="sm">
                                Voir l&apos;hébergement
                              </Button>
                            </Link>
                            <BookingRowActions
                              bookingId={booking.id}
                              bookingReference={booking.bookingReference}
                              propertySlug={property?.slug ?? null}
                              status={booking.status}
                              hostContactEmail={null}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {pastBookings.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Passées ({pastBookings.length})
                </h2>
                <div className="space-y-4">
                  {pastBookings.map(({ booking, property, room }) => (
                    <Card key={booking.id} className="overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
                      <div className="flex flex-col md:flex-row">
                        {property?.mainImage && (
                          <div className="md:w-40 h-32 md:h-auto flex-shrink-0">
                            <img
                              src={property.mainImage}
                              alt={property.name || ""}
                              className="w-full h-full object-cover grayscale"
                            />
                          </div>
                        )}
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge className={getStatusBadgeColor(booking.status)}>
                                {statusLabels[booking.status]}
                              </Badge>
                              <h3 className="font-semibold text-gray-900 mt-2">
                                {property?.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {formatDate(booking.checkIn, { day: "numeric", month: "short" })} - {formatDate(booking.checkOut, { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatPrice(booking.total, booking.currency)}</p>
                              <p className="text-sm text-gray-500">{booking.numNights} nuits</p>
                            </div>
                          </div>
                          
                          {booking.status === "completed" && (
                            <div className="mt-3">
                              <Link
                                href={`/mes-reservations/avis/${booking.id}`}
                                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#F5A623] text-white text-sm font-medium hover:bg-[#e0951f] transition"
                              >
                                <Star className="w-4 h-4 mr-2" />
                                Laisser un avis
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
