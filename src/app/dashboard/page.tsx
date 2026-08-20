import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { properties, bookings, reviews, users } from "@/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatDate, getStatusBadgeColor } from "@/lib/utils";
import { 
  Building2, Calendar, Star, TrendingUp, 
  ArrowUpRight, ArrowDownRight, Users, DollarSign 
} from "lucide-react";
import Link from "next/link";

async function getDashboardStats(userId: string, isAdmin: boolean) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get properties
  let propertiesQuery = db.select().from(properties);
  if (!isAdmin) {
    propertiesQuery = propertiesQuery.where(eq(properties.hostId, userId)) as typeof propertiesQuery;
  }
  const allProperties = await propertiesQuery;

  // Get bookings
  const propertyIds = allProperties.map(p => p.id);
  let allBookings: typeof bookings.$inferSelect[] = [];
  let recentBookings: typeof bookings.$inferSelect[] = [];
  
  if (propertyIds.length > 0 || isAdmin) {
    const bookingsQuery = isAdmin 
      ? db.select().from(bookings)
      : db.select().from(bookings).where(
          sql`${bookings.propertyId} IN ${propertyIds.length > 0 ? sql`(${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})` : sql`('')`}`
        );
    allBookings = await bookingsQuery;
    
    const recentQuery = isAdmin
      ? db.select().from(bookings).where(gte(bookings.createdAt, thirtyDaysAgo))
      : db.select().from(bookings).where(
          and(
            sql`${bookings.propertyId} IN ${propertyIds.length > 0 ? sql`(${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})` : sql`('')`}`,
            gte(bookings.createdAt, thirtyDaysAgo)
          )
        );
    recentBookings = await recentQuery;
  }

  // Calculate stats
  const totalRevenue = allBookings
    .filter(b => b.paymentStatus === "paid")
    .reduce((sum, b) => sum + parseFloat(b.total), 0);
  
  const recentRevenue = recentBookings
    .filter(b => b.paymentStatus === "paid")
    .reduce((sum, b) => sum + parseFloat(b.total), 0);

  // Get reviews count
  let reviewsQuery = db.select().from(reviews);
  if (!isAdmin && propertyIds.length > 0) {
    reviewsQuery = reviewsQuery.where(
      sql`${reviews.propertyId} IN ${sql`(${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`}`
    ) as typeof reviewsQuery;
  }
  const allReviews = isAdmin || propertyIds.length > 0 ? await reviewsQuery : [];

  // Get users count (admin only)
  const usersCount = isAdmin ? await db.select({ count: sql<number>`count(*)` }).from(users) : [{ count: 0 }];

  return {
    properties: {
      total: allProperties.length,
      active: allProperties.filter(p => p.status === "active").length,
      pending: allProperties.filter(p => p.status === "pending").length,
    },
    bookings: {
      total: allBookings.length,
      recent: recentBookings.length,
      confirmed: allBookings.filter(b => b.status === "confirmed").length,
      pending: allBookings.filter(b => b.status === "pending").length,
    },
    revenue: {
      total: totalRevenue,
      recent: recentRevenue,
    },
    reviews: {
      total: allReviews.length,
    },
    users: {
      total: usersCount[0].count,
    },
  };
}

async function getRecentBookings(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return db
      .select({
        booking: bookings,
        property: {
          name: properties.name,
          city: properties.city,
        },
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .orderBy(desc(bookings.createdAt))
      .limit(5);
  }

  const hostProperties = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.hostId, userId));

  if (hostProperties.length === 0) return [];

  const propertyIds = hostProperties.map(p => p.id);

  return db
    .select({
      booking: bookings,
      property: {
        name: properties.name,
        city: properties.city,
      },
      user: {
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .leftJoin(users, eq(bookings.userId, users.id))
    .where(sql`${bookings.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(desc(bookings.createdAt))
    .limit(5);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const stats = await getDashboardStats(user.id, isAdmin);
  const recentBookings = await getRecentBookings(user.id, isAdmin);

  const statCards = [
    {
      title: "Hébergements",
      value: stats.properties.total,
      subValue: `${stats.properties.active} actifs`,
      icon: Building2,
      color: "bg-blue-500",
      href: "/dashboard/properties",
    },
    {
      title: "Réservations",
      value: stats.bookings.total,
      subValue: `${stats.bookings.recent} ce mois`,
      icon: Calendar,
      color: "bg-green-500",
      href: "/dashboard/bookings",
    },
    {
      title: "Revenus",
      value: formatPrice(stats.revenue.total),
      subValue: `${formatPrice(stats.revenue.recent)} ce mois`,
      icon: DollarSign,
      color: "bg-[#F5A623]",
      href: "/dashboard/billing",
    },
    {
      title: isAdmin ? "Utilisateurs" : "Avis",
      value: isAdmin ? stats.users.total : stats.reviews.total,
      subValue: isAdmin ? "inscrits" : "avis vérifiés",
      icon: isAdmin ? Users : Star,
      color: "bg-purple-500",
      href: isAdmin ? "/dashboard/users" : "/dashboard/reviews",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Bonjour, {user.firstName} 👋
        </h1>
        <p className="text-gray-600 mt-1">
          Voici un aperçu de votre activité sur mybestbooking
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    <p className="text-sm text-gray-500 mt-1">{stat.subValue}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Réservations récentes</CardTitle>
            <Link href="/dashboard/bookings" className="text-sm text-[#1B3A6B] hover:underline">
              Voir tout →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucune réservation pour le moment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium">Référence</th>
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Hébergement</th>
                    <th className="pb-3 font-medium">Dates</th>
                    <th className="pb-3 font-medium">Montant</th>
                    <th className="pb-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map(({ booking, property, user: guest }) => (
                    <tr key={booking.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3">
                        <Link href={`/dashboard/bookings/${booking.id}`} className="text-[#1B3A6B] font-medium hover:underline">
                          {booking.bookingReference}
                        </Link>
                      </td>
                      <td className="py-3">
                        {guest?.firstName} {guest?.lastName}
                      </td>
                      <td className="py-3">
                        <div>
                          <p className="font-medium">{property?.name}</p>
                          <p className="text-sm text-gray-500">{property?.city}</p>
                        </div>
                      </td>
                      <td className="py-3 text-sm">
                        {formatDate(booking.checkIn, { day: "numeric", month: "short" })} → {formatDate(booking.checkOut, { day: "numeric", month: "short" })}
                      </td>
                      <td className="py-3 font-medium">
                        {formatPrice(booking.total, booking.currency)}
                      </td>
                      <td className="py-3">
                        <Badge className={getStatusBadgeColor(booking.status)}>
                          {booking.status === "confirmed" ? "Confirmée" : 
                           booking.status === "pending" ? "En attente" :
                           booking.status === "cancelled" ? "Annulée" :
                           booking.status === "completed" ? "Terminée" : booking.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {stats.properties.pending > 0 && isAdmin && (
        <Card className="mt-6 border-yellow-200 bg-yellow-50">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-yellow-700" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-yellow-800">
                  {stats.properties.pending} hébergement{stats.properties.pending > 1 ? "s" : ""} en attente de validation
                </p>
                <p className="text-sm text-yellow-700">
                  Vérifiez et validez les nouveaux hébergements
                </p>
              </div>
              <Link
                href="/dashboard/properties?status=pending"
                className="px-4 py-2 bg-yellow-200 text-yellow-800 font-medium rounded-lg hover:bg-yellow-300 transition-colors"
              >
                Voir
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
