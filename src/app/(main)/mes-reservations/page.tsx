import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties, rooms, reviews } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, formatDate, getStatusBadgeColor } from "@/lib/utils";
import { countryLabel } from "@/lib/country-label";
import { Calendar, MapPin, Star, Clock } from "lucide-react";
import Link from "next/link";
import { BookingRowActions } from "@/components/booking-row-actions";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { SmartImage } from "@/components/ui/smart-image";

/**
 * T-172 — titre localisé + noindex (historique de réservations = données
 * personnelles ; ne doit pas être indexé).
 */
export async function generateMetadata() {
  const t = makeT(await getServerLocale());
  return {
    title: t("bookings.meta.title"),
    robots: { index: false, follow: false },
  };
}

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
      // T-152 (audit n°24, E) : état de l'avis pour ne plus proposer le CTA
      // après dépôt (leftJoin additif, aucune colonne modifiée).
      review: {
        id: reviews.id,
        overallRating: reviews.overallRating,
        status: reviews.status,
      },
    })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .leftJoin(rooms, eq(bookings.roomId, rooms.id))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.checkIn));
}

export default async function MyBookingsPage() {
  const user = await getCurrentUser();
  const locale = await getServerLocale();
  const t = makeT(locale);

  if (!user) {
    redirect("/connexion");
  }

  const myBookings = await getMyBookings(user.id);

  const statusLabels: Record<string, string> = {
    pending: t("status.pending"),
    confirmed: t("status.confirmed"),
    cancelled: t("status.cancelled"),
    completed: t("status.completed"),
    no_show: t("status.no_show"),
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
            {t("bookings.title")}
          </h1>
          <p className="text-gray-600 mt-1">
            {t("bookings.subtitle")}
          </p>
        </div>

        {myBookings.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Calendar className="w-8 h-8" />}
              title={t("common.noBooking")}
              description={t("bookings.emptyDesc")}
              action={
                <Link href="/recherche">
                  <Button>{t("bookings.explore")}</Button>
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
                  {t("bookings.upcoming")} ({upcomingBookings.length})
                </h2>
                <div className="space-y-4">
                  {upcomingBookings.map(({ booking, property, room }) => (
                    <Card key={booking.id} className="overflow-hidden">
                      <div className="flex flex-col md:flex-row">
                        {property?.mainImage && (
                          <div className="md:w-48 h-40 md:h-auto flex-shrink-0 relative">
                            <SmartImage
                              src={property.mainImage}
                              alt={property.name || ""}
                              className="w-full h-full object-cover"
                              sizes="(max-width: 768px) 100vw, 192px"
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
                                {property?.city}, {countryLabel(property?.country, t)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">{t("bookings.ref")}</p>
                              <p className="font-mono font-medium text-[#1B3A6B]">
                                {booking.bookingReference}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-gray-100">
                            <div>
                              <p className="text-xs text-gray-500">{t("book.checkIn")}</p>
                              <p className="font-medium">{formatDate(booking.checkIn, { day: "numeric", month: "short" }, locale)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{t("book.checkOut")}</p>
                              <p className="font-medium">{formatDate(booking.checkOut, { day: "numeric", month: "short" }, locale)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{t("bookings.room")}</p>
                              <p className="font-medium">{room?.name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{t("bookings.total")}</p>
                              <p className="font-bold text-[#1B3A6B]">{formatPrice(booking.total, booking.currency, locale)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mt-4">
                            <Link href={`/hebergement/${property?.slug}`}>
                              <Button variant="outline" size="sm">
                                {t("bookings.viewProperty")}
                              </Button>
                            </Link>
                            <BookingRowActions
                              bookingId={booking.id}
                              bookingReference={booking.bookingReference}
                              propertyId={property?.id ?? booking.propertyId}
                              status={booking.status}
                              paymentStatus={booking.paymentStatus}
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
                  {t("bookings.pastCount").replace("{n}", String(pastBookings.length))}
                </h2>
                <div className="space-y-4">
                  {pastBookings.map(({ booking, property, room, review }) => (
                    <Card key={booking.id} className="overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
                      <div className="flex flex-col md:flex-row">
                        {property?.mainImage && (
                          <div className="md:w-40 h-32 md:h-auto flex-shrink-0 relative">
                            <SmartImage
                              src={property.mainImage}
                              alt={property.name || ""}
                              className="w-full h-full object-cover grayscale"
                              sizes="(max-width: 768px) 100vw, 160px"
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
                                {formatDate(booking.checkIn, { day: "numeric", month: "short" }, locale)} - {formatDate(booking.checkOut, { day: "numeric", month: "short", year: "numeric" }, locale)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatPrice(booking.total, booking.currency, locale)}</p>
                              <p className="text-sm text-gray-500">{booking.numNights} {booking.numNights === 1 ? t("bookings.nights") : t("bookings.nightsPlural")}</p>
                            </div>
                          </div>
                          
                          {booking.status === "cancelled" && (
                            <div className="mt-3 text-sm rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900">
                              {t("bookings.fee")} : {formatPrice(booking.cancellationFee ?? "0", booking.currency, locale)} · {t("bookings.refund")} : {formatPrice(booking.refundAmount ?? "0", booking.currency, locale)} ({booking.refundStatus === "refunded" ? t("bookings.refundDone") : booking.refundStatus === "pending" ? t("bookings.refundPending") : t("bookings.refundNone")})
                            </div>
                          )}
                          {/* T-153 (audit n°25, G) : séjour passé mais non
                              terminé (checkOut < aujourd'hui, status
                              confirmed) — l'utilisateur sait pourquoi le CTA
                              d'avis n'est pas encore affiché. */}
                          {booking.status === "confirmed" && new Date(booking.checkOut) < today && (
                            <div className="mt-3 text-sm rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-900">
                              <Clock className="w-4 h-4 inline mr-1" />
                              {t("bookings.reviewSoon")}
                            </div>
                          )}
                          {booking.status === "completed" && (
                            <div className="mt-3">
                              {review?.id ? (
                                // T-152 (E) : l'avis existe, on affiche son état
                                // au lieu de proposer à nouveau le formulaire.
                                <Link
                                  href={`/mes-reservations/avis/${booking.id}`}
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-50 text-green-800 text-sm font-medium hover:bg-green-100 transition"
                                >
                                  <Star className="w-4 h-4 mr-2" />
                                  {review.status === "approved"
                                    ? `✓ ${t("bookings.reviewPublished")} (${review.overallRating ?? "–"}/10)`
                                    : review.status === "pending"
                                      ? t("bookings.reviewPending")
                                      : t("bookings.reviewSubmitted")}
                                </Link>
                              ) : (
                                <Link
                                  href={`/mes-reservations/avis/${booking.id}`}
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#F5A623] text-white text-sm font-medium hover:bg-[#e0951f] transition"
                                >
                                  <Star className="w-4 h-4 mr-2" />
                                  {t("bookings.leaveReview")}
                                </Link>
                              )}
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
