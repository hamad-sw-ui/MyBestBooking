import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties, rooms, users, reviews } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate, getStatusBadgeColor } from "@/lib/utils";
import { 
  ArrowLeft, Calendar, User, Mail, Phone, MapPin, 
  CreditCard, MessageSquare, Download, Clock, Star,
  CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { BookingRowActions } from "@/components/booking-row-actions";

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getBookingDetails(id: string, userId: string, isAdmin: boolean) {
  const [result] = await db
    .select({
      booking: bookings,
      property: properties,
      room: rooms,
      guest: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        country: users.country,
        bestrewardsLevel: users.bestrewardsLevel,
      },
    })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .leftJoin(rooms, eq(bookings.roomId, rooms.id))
    .leftJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.id, id));

  if (!result) return null;

  // Check authorization
  const isOwner = result.booking.userId === userId;
  const isHost = result.property?.hostId === userId;

  if (!isOwner && !isHost && !isAdmin) {
    return null;
  }

  // Get review if exists
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.bookingId, id));

  return { ...result, review };
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const { id } = await params;
  const isAdmin = user.role === "admin";
  const data = await getBookingDetails(id, user.id, isAdmin);

  if (!data) {
    notFound();
  }

  const { booking, property, room, guest, review } = data;

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    confirmed: "Confirmée",
    cancelled: "Annulée",
    completed: "Terminée",
    no_show: "No-show",
  };

  const paymentStatusLabels: Record<string, string> = {
    pending: "En attente",
    paid: "Payé",
    partially_refunded: "Partiellement remboursé",
    refunded: "Remboursé",
  };

  const timeline = [
    { 
      label: "Réservation créée", 
      date: booking.createdAt, 
      icon: Calendar, 
      completed: true 
    },
    { 
      label: "Paiement confirmé", 
      date: booking.createdAt, 
      icon: CreditCard, 
      completed: booking.paymentStatus === "paid" 
    },
    { 
      label: "Check-in", 
      date: new Date(booking.checkIn), 
      icon: CheckCircle, 
      completed: booking.status === "completed" || new Date(booking.checkIn) < new Date()
    },
    { 
      label: "Check-out", 
      date: new Date(booking.checkOut), 
      icon: CheckCircle, 
      completed: booking.status === "completed" 
    },
  ];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux réservations
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Réservation {booking.bookingReference}
            </h1>
            <p className="text-gray-600 mt-1">
              Créée le {formatDate(booking.createdAt)}
            </p>
          </div>
          <Badge className={`${getStatusBadgeColor(booking.status)} text-base px-4 py-1`}>
            {statusLabels[booking.status]}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property & Room */}
          <Card>
            <CardHeader>
              <CardTitle>Hébergement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {property?.mainImage && (
                  <img
                    src={property.mainImage}
                    alt={property.name || ""}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{property?.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {property?.city}, {property?.country}
                  </p>
                  <div className="mt-2">
                    <Badge variant="info">{room?.name}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle>Dates du séjour</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Arrivée</p>
                  <p className="text-lg font-bold">{formatDate(booking.checkIn, { day: "numeric", month: "short" })}</p>
                  <p className="text-sm text-gray-500">à partir de {property?.checkInFrom || "14:00"}</p>
                </div>
                <div className="text-center p-4 bg-[#1B3A6B] text-white rounded-lg">
                  <p className="text-sm text-white/70">Durée</p>
                  <p className="text-2xl font-bold">{booking.numNights}</p>
                  <p className="text-sm text-white/70">nuit{booking.numNights > 1 ? "s" : ""}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Départ</p>
                  <p className="text-lg font-bold">{formatDate(booking.checkOut, { day: "numeric", month: "short" })}</p>
                  <p className="text-sm text-gray-500">avant {property?.checkOutUntil || "11:00"}</p>
                </div>
              </div>
              <div className="mt-4 text-center text-sm text-gray-500">
                {booking.numAdults} adulte{booking.numAdults > 1 ? "s" : ""}
                {booking.numChildren && booking.numChildren > 0 && `, ${booking.numChildren} enfant${booking.numChildren > 1 ? "s" : ""}`}
              </div>
            </CardContent>
          </Card>

          {/* Guest Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informations du voyageur</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white font-medium">
                    {booking.guestFirstName.charAt(0)}{booking.guestLastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{booking.guestFirstName} {booking.guestLastName}</p>
                    {guest?.bestrewardsLevel && (
                      <Badge variant="bestrewards" className="text-xs">
                        💎 Level {guest.bestrewardsLevel}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{booking.guestEmail}</span>
                </div>
                {booking.guestPhone && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{booking.guestPhone}</span>
                  </div>
                )}
                {booking.tripPurpose && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <User className="w-4 h-4" />
                    <span className="capitalize">{booking.tripPurpose === "leisure" ? "Loisirs" : "Affaires"}</span>
                  </div>
                )}
              </div>
              {booking.specialRequests && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">Demandes spéciales</p>
                  <p className="text-sm text-yellow-700 mt-1">{booking.specialRequests}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review */}
          {review && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-[#F5A623]" />
                  Avis du voyageur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <div className="px-3 py-1 bg-[#1B3A6B] text-white font-bold rounded">
                    {parseFloat(review.overallRating).toFixed(1)}
                  </div>
                  <span className="text-gray-600">
                    Publié le {formatDate(review.createdAt)}
                  </span>
                </div>
                {review.positiveComment && (
                  <p className="text-gray-700 mb-2">
                    <span className="text-green-600">👍</span> {review.positiveComment}
                  </p>
                )}
                {review.negativeComment && (
                  <p className="text-gray-600">
                    <span className="text-gray-400">👎</span> {review.negativeComment}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Chambre × {booking.numNights} nuits</span>
                <span>{formatPrice(booking.subtotal, booking.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Taxes et frais</span>
                <span>{formatPrice(booking.taxes || "0", booking.currency)}</span>
              </div>
              {parseFloat(booking.discount || "0") > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Réduction</span>
                  <span>-{formatPrice(booking.discount || "0", booking.currency)}</span>
                </div>
              )}
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-[#1B3A6B]">{formatPrice(booking.total, booking.currency)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{booking.paymentMethod || "Carte"}</span>
                <Badge className={getStatusBadgeColor(booking.paymentStatus || "pending")}>
                  {paymentStatusLabels[booking.paymentStatus || "pending"]}
                </Badge>
              </div>
            </CardContent>
            {isAdmin && (
              <CardFooter className="bg-gray-50 border-t">
                <div className="w-full space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Commission ({booking.commissionRate}%)</span>
                    <span className="text-green-600 font-medium">
                      {formatPrice(booking.commissionAmount, booking.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Net hébergeur</span>
                    <span>{formatPrice(booking.netToHost, booking.currency)}</span>
                  </div>
                </div>
              </CardFooter>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeline.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.completed ? "bg-green-100" : "bg-gray-100"
                    }`}>
                      <item.icon className={`w-4 h-4 ${
                        item.completed ? "text-green-600" : "text-gray-400"
                      }`} />
                    </div>
                    <div>
                      <p className={`font-medium ${item.completed ? "text-gray-900" : "text-gray-400"}`}>
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(item.date, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions — T-031 branchées */}
          <Card>
            <CardContent className="flex flex-wrap gap-2">
              <BookingRowActions
                bookingId={booking.id}
                bookingReference={booking.bookingReference}
                propertyId={booking.propertyId}
                status={booking.status}
                messageArea="dashboard"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
