import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties, reviews, rooms, users } from "@/db/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import {
  sumByCurrency,
  topCurrency,
  currenciesOf,
  formatCurrencyBreakdown,
} from "@/lib/currency-summary";
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, 
  Users, Star, Building2, Eye, BarChart3 
} from "lucide-react";

async function getAnalytics(userId: string, isAdmin: boolean) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Get properties
  const propertiesQuery = isAdmin 
    ? db.select().from(properties)
    : db.select().from(properties).where(eq(properties.hostId, userId));
  const allProperties = await propertiesQuery;
  const propertyIds = allProperties.map(p => p.id);

  if (propertyIds.length === 0 && !isAdmin) {
    return null;
  }

  // Get all bookings
  const allBookingsQuery = isAdmin
    ? db.select().from(bookings)
    : db.select().from(bookings).where(
        sql`${bookings.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`
      );
  const allBookings = await allBookingsQuery;

  // Get bookings for current period (last 30 days)
  const currentPeriodBookings = allBookings.filter(
    b => new Date(b.createdAt) >= thirtyDaysAgo && b.status !== "cancelled"
  );

  // Get bookings for previous period (30-60 days ago)
  const previousPeriodBookings = allBookings.filter(
    b => new Date(b.createdAt) >= sixtyDaysAgo && new Date(b.createdAt) < thirtyDaysAgo && b.status !== "cancelled"
  );

  // Calculate metrics — T-152 (audit n°24, C) : les totaux sont regroupés
  // PAR DEVISE. On n'additionne jamais deux devises dans un montant affiché ;
  // les pourcentages d'évolution restent calculés sur les flux (toutes
  // devises mêlées = simple comparaison de flux, étiquetée comme telle).
  const currentRevenueByCurrency = sumByCurrency(
    currentPeriodBookings
      .filter(b => b.paymentStatus === "paid")
      .map(b => ({ currency: b.currency, amount: parseFloat(b.total) })),
  );
  const previousRevenueByCurrency = sumByCurrency(
    previousPeriodBookings
      .filter(b => b.paymentStatus === "paid")
      .map(b => ({ currency: b.currency, amount: parseFloat(b.total) })),
  );
  const currentRevenue = Object.values(currentRevenueByCurrency).reduce((sum, v) => sum + v, 0);
  const previousRevenue = Object.values(previousRevenueByCurrency).reduce((sum, v) => sum + v, 0);

  const revenueChange = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : 100;

  const currentBookingsCount = currentPeriodBookings.length;
  const previousBookingsCount = previousPeriodBookings.length;
  const bookingsChange = previousBookingsCount > 0
    ? ((currentBookingsCount - previousBookingsCount) / previousBookingsCount) * 100
    : 100;

  // Average booking value (par devise, pour ne jamais afficher un panier
  // moyen calculé sur des devises mélangées).
  const currentPaidBookings = currentPeriodBookings.filter(b => b.paymentStatus === "paid");
  const previousPaidBookings = previousPeriodBookings.filter(b => b.paymentStatus === "paid");
  const avgBookingValueByCurrency: Record<string, number> = {};
  for (const [currency, revenue] of Object.entries(currentRevenueByCurrency)) {
    const count = currentPaidBookings.filter(b => (b.currency || "EUR").toUpperCase() === currency).length;
    avgBookingValueByCurrency[currency] = count > 0 ? revenue / count : 0;
  }
  const avgBookingValue = currentPaidBookings.length > 0
    ? currentRevenue / currentPaidBookings.length
    : 0;

  const previousAvgBookingValue = previousPaidBookings.length > 0
    ? previousRevenue / previousPaidBookings.length
    : 0;

  // Occupation sur les nuits réellement situées dans la fenêtre, et non sur
  // la date de création de la réservation. Les annulations sont exclues.
  const propertyRooms = propertyIds.length > 0
    ? await db.select({ quantity: rooms.quantity }).from(rooms).where(
        and(eq(rooms.isActive, true), sql`${rooms.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`),
      )
    : [];
  const startDay = thirtyDaysAgo.toISOString().slice(0, 10);
  const endDay = now.toISOString().slice(0, 10);
  const occupiedNights = allBookings
    .filter((booking) => booking.status !== "cancelled" && booking.checkIn <= endDay && booking.checkOut > startDay)
    .reduce((sum, booking) => {
      const from = booking.checkIn > startDay ? booking.checkIn : startDay;
      const until = booking.checkOut < endDay ? booking.checkOut : endDay;
      const nights = Math.max(0, Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
      return sum + nights;
    }, 0);
  const potentialNights = propertyRooms.reduce((sum, room) => sum + (room.quantity ?? 1) * 30, 0);
  const occupancyRate = potentialNights > 0 ? (occupiedNights / potentialNights) * 100 : 0;

  // Average rating
  const reviewsQuery = isAdmin
    ? db.select().from(reviews)
    : db.select().from(reviews).where(
        sql`${reviews.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`
      );
  const allReviews = await reviewsQuery;
  const avgRating = allReviews.length > 0
    ? allReviews.reduce((sum, r) => sum + parseFloat(r.overallRating), 0) / allReviews.length
    : 0;

  // Revenue by day (last 30 days) — T-152 (C) : une SEULE devise par série
  // (la dominante de la période). Les autres devises ne sont pas mélangées
  // dans les barres ; elles sont signalées à l'affichage.
  const chartCurrency = topCurrency(currentRevenueByCurrency) ?? "EUR";
  const otherCurrencies = currenciesOf(currentRevenueByCurrency).filter(c => c !== chartCurrency);
  const revenueByDay: { date: string; revenue: number; currency: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayRevenue = currentPeriodBookings
      .filter(b => {
        const bDate = new Date(b.createdAt).toISOString().split('T')[0];
        return bDate === dateStr && b.paymentStatus === "paid" &&
          (b.currency || "EUR").toUpperCase() === chartCurrency;
      })
      .reduce((sum, b) => sum + parseFloat(b.total), 0);
    
    revenueByDay.push({ date: dateStr, revenue: dayRevenue, currency: chartCurrency });
  }

  // Top properties (répartition par devise, jamais additionnée à l'affichage)
  const propertyRevenue = new Map<string, { name: string; revenueByCurrency: Record<string, number>; bookings: number }>();
  for (const booking of allBookings) {
    if (booking.status === "cancelled" || booking.paymentStatus !== "paid") continue;
    const prop = allProperties.find(p => p.id === booking.propertyId);
    if (!prop) continue;
    
    const current = propertyRevenue.get(prop.id) || { name: prop.name, revenueByCurrency: {}, bookings: 0 };
    const currency = (booking.currency || "EUR").toUpperCase();
    current.revenueByCurrency[currency] = (current.revenueByCurrency[currency] ?? 0) + parseFloat(booking.total);
    current.bookings += 1;
    propertyRevenue.set(prop.id, current);
  }

  const topProperties = Array.from(propertyRevenue.entries())
    .sort((a, b) => (b[1].revenueByCurrency[chartCurrency] ?? 0) - (a[1].revenueByCurrency[chartCurrency] ?? 0))
    .slice(0, 5)
    .map(([id, data]) => ({ id, ...data }));


  return {
    currentRevenueByCurrency,
    previousRevenueByCurrency,
    avgBookingValueByCurrency,
    currentRevenue,
    previousRevenue,
    revenueChange,
    currentBookingsCount,
    previousBookingsCount,
    bookingsChange,
    avgBookingValue,
    previousAvgBookingValue,
    occupancyRate,
    avgRating,
    totalReviews: allReviews.length,
    revenueByDay,
    chartCurrency,
    otherCurrencies,
    topProperties,
    totalProperties: allProperties.length,
    totalBookings: allBookings.length,
  };
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const analytics = await getAnalytics(user.id, isAdmin);
  const locale = await getServerLocale();
  const t = makeT(locale);

  if (!analytics) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {t("dash.analytics")}
        </h1>
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">{t("analytics.noData")}</p>
            <p className="text-sm text-gray-400 mt-1">{t("analytics.noDataHint")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metrics = [
    {
      title: t("analytics.revenue30"),
      value: formatCurrencyBreakdown(analytics.currentRevenueByCurrency),
      change: analytics.revenueChange,
      icon: DollarSign,
      color: "bg-green-500",
    },
    {
      title: t("analytics.bookings30"),
      value: analytics.currentBookingsCount.toString(),
      change: analytics.bookingsChange,
      icon: Calendar,
      color: "bg-blue-500",
    },
    {
      title: t("analytics.avgBasket"),
      value: formatCurrencyBreakdown(analytics.avgBookingValueByCurrency),
      change: analytics.previousAvgBookingValue > 0 
        ? ((analytics.avgBookingValue - analytics.previousAvgBookingValue) / analytics.previousAvgBookingValue) * 100 
        : 0,
      icon: TrendingUp,
      color: "bg-purple-500",
    },
    {
      title: t("analytics.avgRating"),
      value: analytics.avgRating.toFixed(1) + "/10",
      icon: Star,
      color: "bg-[#F5A623]",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {t("dash.analytics")}
        </h1>
        <p className="text-gray-600 mt-1">
          {t("analytics.subtitle")}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg ${metric.color} flex items-center justify-center`}>
                  <metric.icon className="w-5 h-5 text-white" />
                </div>
                {metric.change !== undefined && (
                  <div className={`flex items-center gap-1 text-sm ${
                    metric.change >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {metric.change >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span>{Math.abs(metric.change).toFixed(1)}%</span>
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              <p className="text-sm text-gray-500">{metric.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart (simplified bar representation) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.revenuePerDay").replace("{currency}", analytics.chartCurrency)}</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.otherCurrencies.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                {t("analytics.otherCurrenciesNote")
                  .replace("{list}", analytics.otherCurrencies.join(", "))
                  .replace("{currency}", analytics.chartCurrency)}
              </p>
            )}
            <div className="h-48 flex items-end gap-1">
              {analytics.revenueByDay.slice(-14).map((day, i) => {
                const maxRevenue = Math.max(...analytics.revenueByDay.map(d => d.revenue));
                const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-[#1B3A6B] rounded-t transition-all hover:bg-[#152d54]"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${new Date(day.date).toLocaleDateString('fr-FR')}: ${formatPrice(day.revenue, day.currency)}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>{t("analytics.daysAgo14")}</span>
              <span>{t("analytics.today")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Properties */}
        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.topProperties")}</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topProperties.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t("analytics.none")}</p>
            ) : (
              <div className="space-y-4">
                {analytics.topProperties.map((prop, i) => (
                  <div key={prop.id} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{prop.name}</p>
                      <p className="text-sm text-gray-500">{t("analytics.nBookings").replace("{n}", String(prop.bookings))}</p>
                    </div>
                    <p className="font-bold text-[#1B3A6B]">{formatCurrencyBreakdown(prop.revenueByCurrency)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.overview")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">{t("analytics.properties")}</span>
                </div>
                <p className="text-2xl font-bold">{analytics.totalProperties}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">{t("analytics.totalBookings")}</span>
                </div>
                <p className="text-2xl font-bold">{analytics.totalBookings}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">{t("analytics.reviewsCollected")}</span>
                </div>
                <p className="text-2xl font-bold">{analytics.totalReviews}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">{t("analytics.occupancy")}</span>
                </div>
                <p className="text-2xl font-bold">{analytics.occupancyRate.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sources */}
        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.sources")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">{t("analytics.sourcesNote")}</p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
