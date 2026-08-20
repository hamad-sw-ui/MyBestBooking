import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties, rooms, users } from "@/db/schema";
import { eq, desc, sql, or } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, formatDate, getStatusBadgeColor } from "@/lib/utils";
import { Calendar, Eye, Download, MessageSquare } from "lucide-react";
import Link from "next/link";

async function getBookings(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return db
      .select({
        booking: bookings,
        property: {
          id: properties.id,
          name: properties.name,
          city: properties.city,
          mainImage: properties.mainImage,
        },
        room: {
          name: rooms.name,
          roomType: rooms.roomType,
        },
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .orderBy(desc(bookings.createdAt));
  }

  // Get host's properties
  const hostProperties = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.hostId, userId));

  if (hostProperties.length === 0) {
    return [];
  }

  const propertyIds = hostProperties.map((p) => p.id);

  return db
    .select({
      booking: bookings,
      property: {
        id: properties.id,
        name: properties.name,
        city: properties.city,
        mainImage: properties.mainImage,
      },
      room: {
        name: rooms.name,
        roomType: rooms.roomType,
      },
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .leftJoin(rooms, eq(bookings.roomId, rooms.id))
    .leftJoin(users, eq(bookings.userId, users.id))
    .where(or(...propertyIds.map((id) => eq(bookings.propertyId, id))))
    .orderBy(desc(bookings.createdAt));
}

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const allBookings = await getBookings(user.id, isAdmin);

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    confirmed: "Confirmée",
    cancelled: "Annulée",
    completed: "Terminée",
    no_show: "No-show",
  };

  // Calculate stats
  const stats = {
    total: allBookings.length,
    confirmed: allBookings.filter((b) => b.booking.status === "confirmed").length,
    pending: allBookings.filter((b) => b.booking.status === "pending").length,
    totalRevenue: allBookings
      .filter((b) => b.booking.paymentStatus === "paid")
      .reduce((sum, b) => sum + parseFloat(b.booking.total), 0),
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Réservations
        </h1>
        <p className="text-gray-600 mt-1">
          {isAdmin ? "Gérez toutes les réservations" : "Gérez les réservations de vos hébergements"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Confirmées</p>
            <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">En attente</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Revenus</p>
            <p className="text-2xl font-bold text-[#1B3A6B]">{formatPrice(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bookings List */}
      <Card padding="none">
        {allBookings.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            title="Aucune réservation"
            description="Les réservations de vos hébergements apparaîtront ici"
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-4 font-medium">Référence</th>
                  <th className="px-6 py-4 font-medium">Client</th>
                  <th className="px-6 py-4 font-medium">Hébergement</th>
                  <th className="px-6 py-4 font-medium">Chambre</th>
                  <th className="px-6 py-4 font-medium">Dates</th>
                  <th className="px-6 py-4 font-medium">Montant</th>
                  <th className="px-6 py-4 font-medium">Statut</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allBookings.map(({ booking, property, room, user: guest }) => (
                  <tr key={booking.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-[#1B3A6B]">
                        {booking.bookingReference}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium">{booking.guestFirstName} {booking.guestLastName}</p>
                        <p className="text-sm text-gray-500">{booking.guestEmail}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {property?.mainImage && (
                          <img
                            src={property.mainImage}
                            alt=""
                            className="w-10 h-10 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium">{property?.name}</p>
                          <p className="text-sm text-gray-500">{property?.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {room?.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p>{formatDate(booking.checkIn, { day: "numeric", month: "short" })}</p>
                        <p className="text-gray-500">→ {formatDate(booking.checkOut, { day: "numeric", month: "short" })}</p>
                        <p className="text-xs text-gray-400">{booking.numNights} nuits</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium">{formatPrice(booking.total, booking.currency)}</p>
                      {isAdmin && (
                        <p className="text-xs text-green-600">
                          Commission: {formatPrice(booking.commissionAmount, booking.currency)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={getStatusBadgeColor(booking.status)}>
                        {statusLabels[booking.status] || booking.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/bookings/${booking.id}`}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                        <button
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Envoyer un message"
                        >
                          <MessageSquare className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
