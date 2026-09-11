import { getCurrentUser } from "@/lib/auth";
import { formatCivilDate } from "@/lib/dates";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { formatCurrencyBreakdown, formatCurrencyConverted } from "@/lib/currency-summary";
import { normalizeDisplayCurrency } from "@/lib/i18n";
import { getAnalytics } from "@/lib/analytics";
import { defaultPeriod, parseAnalyticsPeriod } from "@/lib/analytics-period";
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, 
  Users, Star, Building2, Eye, BarChart3 
} from "lucide-react";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = user.role === "admin";
  // T-241 (F12) : `?from&to` (dates civiles) ; sans paramètre, la période
  // reste « 30 derniers jours » — les chiffres affichés sont identiques à
  // ceux d'avant l'ajout du sélecteur.
  const { from, to } = await searchParams;
  const parsed = parseAnalyticsPeriod(from, to);
  const period = "period" in parsed ? parsed.period : defaultPeriod();
  const analytics = await getAnalytics(user.id, isAdmin, period);
  const locale = await getServerLocale();
  const t = makeT(locale);
  // Période invalide dans l'URL : on retombe sur le défaut et on le dit.
  const periodNotice = "error" in parsed && (from || to) ? t("analytics.periodInvalid") : null;
  // T-195 — devise d'affichage (préférence compte) pour les totaux convertis.
  const displayCurrency = normalizeDisplayCurrency(user.currency, "EUR");

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
      title: t("analytics.revenuePeriod").replace("{days}", String(analytics.period.days)),
      value: formatCurrencyConverted(analytics.currentRevenueByCurrency, displayCurrency, locale),
      change: analytics.revenueChange,
      icon: DollarSign,
      color: "bg-green-500",
    },
    {
      title: t("analytics.bookingsPeriod").replace("{days}", String(analytics.period.days)),
      value: analytics.currentBookingsCount.toString(),
      change: analytics.bookingsChange,
      icon: Calendar,
      color: "bg-blue-500",
    },
    {
      title: t("analytics.avgBasket"),
      value: formatCurrencyConverted(analytics.avgBookingValueByCurrency, displayCurrency, locale),
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

      {/* T-241 (F12) — période analysée : deux dates, appliquer, exporter. */}
      <Card className="mb-6">
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-sm text-gray-600">
              {t("analytics.from")}
              <input
                type="date"
                name="from"
                defaultValue={analytics.period.from}
                max={analytics.period.to}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <label className="flex flex-col text-sm text-gray-600">
              {t("analytics.to")}
              <input
                type="date"
                name="to"
                defaultValue={analytics.period.to}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-[#1B3A6B] px-4 py-2 text-sm font-medium text-white hover:bg-[#152d54]"
            >
              {t("analytics.apply")}
            </button>
            <a
              href={`/api/dashboard/analytics/export?from=${analytics.period.from}&to=${analytics.period.to}`}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("analytics.exportCsv")}
            </a>
            <span className="text-xs text-gray-500">
              {t("analytics.periodSummary")
                .replace("{from}", formatCivilDate(analytics.period.from, { day: "numeric", month: "long", year: "numeric" }, locale))
                .replace("{to}", formatCivilDate(analytics.period.to, { day: "numeric", month: "long", year: "numeric" }, locale))
                .replace("{days}", String(analytics.period.days))}
            </span>
          </form>
          {periodNotice && (
            <p className="mt-3 text-sm text-amber-700">{periodNotice}</p>
          )}
        </CardContent>
      </Card>

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
                    title={`${formatCivilDate(day.date, { day: "numeric", month: "numeric", year: "numeric" }, locale)}: ${formatPrice(day.revenue, day.currency, locale)}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>{t("analytics.chartFrom")}</span>
              <span>{formatCivilDate(analytics.revenueByDay[analytics.revenueByDay.length - 1]?.date ?? analytics.period.to, { day: "numeric", month: "numeric" }, locale)}</span>
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
