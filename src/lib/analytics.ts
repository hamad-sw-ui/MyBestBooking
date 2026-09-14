import { db } from "@/db";
import { bookings, properties, reviews, rooms } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  sumByCurrency,
  topCurrencyByValue,
  currenciesOf,
  sumByCurrencyConverted,
  unconvertibleCurrencies,
} from "@/lib/currency-summary";
import { isDisplayCurrency } from "@/lib/i18n";
import { civilRange, type AnalyticsPeriod } from "@/lib/analytics-period";
import { shiftCivilDays } from "@/lib/analytics-period";

/**
 * T-241 (F12) — agrégats du tableau de bord, extraits de la page pour être
 * partagés par le sélecteur de période **et** l'export CSV.
 *
 * Toutes les fenêtres sont fournies par `AnalyticsPeriod` (dates civiles,
 * T-232) : la lecture en base ne dépend donc jamais du fuseau du serveur.
 */
export async function getAnalytics(userId: string, isAdmin: boolean, period: AnalyticsPeriod, displayCurrency = "EUR") {
  const targetCurrency = isDisplayCurrency(displayCurrency) ? displayCurrency.toUpperCase() : "EUR";
  const propertiesQuery = isAdmin
    ? db.select().from(properties)
    : db.select().from(properties).where(eq(properties.hostId, userId));
  const allProperties = await propertiesQuery;
  const propertyIds = allProperties.map((p) => p.id);

  if (propertyIds.length === 0 && !isAdmin) {
    return null;
  }

  const allBookingsQuery = isAdmin
    ? db.select().from(bookings)
    : db.select().from(bookings).where(
        sql`${bookings.propertyId} IN (${sql.join(propertyIds.map((id) => sql`${id}`), sql`, `)})`,
      );
  const allBookings = await allBookingsQuery;

  const { start: currentStart, end: currentEnd } = civilRange(period.from, period.to);
  const { start: previousStart, end: previousEnd } = civilRange(period.previousFrom, period.previousTo);
  const createdAt = (row: (typeof allBookings)[number]) => new Date(row.createdAt as unknown as string);

  const currentPeriodBookings = allBookings.filter(
    (b) => createdAt(b) >= currentStart && createdAt(b) <= currentEnd && b.status !== "cancelled",
  );
  const previousPeriodBookings = allBookings.filter(
    (b) => createdAt(b) >= previousStart && createdAt(b) <= previousEnd && b.status !== "cancelled",
  );
  const paidItems = (rows: typeof allBookings) => rows
    .filter((b) => b.paymentStatus === "paid")
    .map((b) => ({ currency: b.currency, amount: parseFloat(b.total) }));

  // Les données restent groupées par devise native. Les KPI et la série
  // affichée utilisent ensuite une conversion indicative explicite vers la
  // préférence du compte ; aucune écriture transactionnelle n'est modifiée.
  const currentRevenueByCurrency = sumByCurrency(
    currentPeriodBookings
      .filter((b) => b.paymentStatus === "paid")
      .map((b) => ({ currency: b.currency, amount: parseFloat(b.total) })),
  );
  const previousRevenueByCurrency = sumByCurrency(
    previousPeriodBookings
      .filter((b) => b.paymentStatus === "paid")
      .map((b) => ({ currency: b.currency, amount: parseFloat(b.total) })),
  );
  const comparisonCurrency = topCurrencyByValue(currentRevenueByCurrency, targetCurrency)
    ?? topCurrencyByValue(previousRevenueByCurrency, targetCurrency)
    ?? "EUR";
  const currentDisplayRevenue = sumByCurrencyConverted(paidItems(currentPeriodBookings), targetCurrency);
  const previousDisplayRevenue = sumByCurrencyConverted(paidItems(previousPeriodBookings), targetCurrency);
  const currentRevenue = currentDisplayRevenue.total;
  const previousRevenue = previousDisplayRevenue.total;

  const revenueChange = previousRevenue > 0
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
    : 100;

  const currentBookingsCount = currentPeriodBookings.length;
  const previousBookingsCount = previousPeriodBookings.length;
  const bookingsChange = previousBookingsCount > 0
    ? ((currentBookingsCount - previousBookingsCount) / previousBookingsCount) * 100
    : 100;

  const currentPaidBookings = currentPeriodBookings.filter((b) => b.paymentStatus === "paid");
  const previousPaidBookings = previousPeriodBookings.filter((b) => b.paymentStatus === "paid");
  const avgBookingValueByCurrency: Record<string, number> = {};
  for (const [currency, revenue] of Object.entries(currentRevenueByCurrency)) {
    const count = currentPaidBookings.filter((b) => (b.currency || "EUR").toUpperCase() === currency).length;
    avgBookingValueByCurrency[currency] = count > 0 ? revenue / count : 0;
  }
  const avgBookingValue = currentPaidBookings.length > 0 ? currentRevenue / currentPaidBookings.length : 0;
  const previousAvgBookingValue = previousPaidBookings.length > 0 ? previousRevenue / previousPaidBookings.length : 0;
  const unknownCurrencies = Array.from(new Set([
    ...unconvertibleCurrencies(currentRevenueByCurrency),
    ...unconvertibleCurrencies(previousRevenueByCurrency),
  ])).sort();

  // Occupation : nuits réellement situées dans la fenêtre (les annulations
  // sont exclues), rapportées au stock déclaré × nombre de nuits de la période.
  const propertyRooms = propertyIds.length > 0
    ? await db.select({ quantity: rooms.quantity }).from(rooms).where(
        and(eq(rooms.isActive, true), sql`${rooms.propertyId} IN (${sql.join(propertyIds.map((id) => sql`${id}`), sql`, `)})`),
      )
    : [];
  const startDay = period.from;
  const endDay = period.to;
  const occupiedNights = allBookings
    .filter((booking) => booking.status !== "cancelled" && booking.checkIn <= endDay && booking.checkOut > startDay)
    .reduce((sum, booking) => {
      const from = booking.checkIn > startDay ? booking.checkIn : startDay;
      const until = booking.checkOut < endDay ? booking.checkOut : endDay;
      const nights = Math.max(0, Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
      return sum + nights;
    }, 0);
  const potentialNights = propertyRooms.reduce((sum, room) => sum + (room.quantity ?? 1) * period.days, 0);
  const occupancyRate = potentialNights > 0 ? (occupiedNights / potentialNights) * 100 : 0;

  const reviewsQuery = isAdmin
    ? db.select().from(reviews)
    : db.select().from(reviews).where(
        sql`${reviews.propertyId} IN (${sql.join(propertyIds.map((id) => sql`${id}`), sql`, `)})`,
      );
  const allReviews = await reviewsQuery;
  // T-205 : la note moyenne du dashboard doit rester alignée avec la fiche
  // publique et `properties.averageRating` : seuls les avis approuvés comptent.
  const approvedReviews = allReviews.filter((review) => review.status === "approved");
  const avgRating = approvedReviews.length > 0
    ? approvedReviews.reduce((sum, r) => sum + parseFloat(r.overallRating), 0) / approvedReviews.length
    : 0;

  // Série journalière : toutes les devises sources sont converties dans la
  // devise choisie pour éviter qu'une valeur nominale XAF domine un EUR.
  const chartCurrency = targetCurrency;
  const chartDays = Math.min(period.days, 31);
  const chartFrom = shiftCivilDays(period.to, -(chartDays - 1));
  const otherCurrencies = currenciesOf(currentRevenueByCurrency).filter((c) => c !== chartCurrency);
  const revenueByDay: { date: string; revenue: number; currency: string }[] = [];
  for (let i = 0; i < chartDays; i++) {
    const dateStr = shiftCivilDays(chartFrom, i);
    const dayItems = currentPeriodBookings.filter((b) => {
      const bDate = civilDayOf(createdAt(b));
      return bDate === dateStr && b.paymentStatus === "paid";
    });
    const dayRevenue = sumByCurrencyConverted(
      dayItems.map((b) => ({ currency: b.currency, amount: parseFloat(b.total) })),
      targetCurrency,
    ).total;
    revenueByDay.push({ date: dateStr, revenue: dayRevenue, currency: chartCurrency });
  }

  // Top hébergements : classement après conversion dans une base commune,
  // tout en gardant la répartition native pour audit et export.
  const propertyRevenue = new Map<string, { name: string; revenueByCurrency: Record<string, number>; bookings: number }>();
  for (const booking of currentPeriodBookings) {
    if (booking.paymentStatus !== "paid") continue;
    const prop = allProperties.find((p) => p.id === booking.propertyId);
    if (!prop) continue;

    const current = propertyRevenue.get(prop.id) || { name: prop.name, revenueByCurrency: {}, bookings: 0 };
    const currency = (booking.currency || "EUR").toUpperCase();
    current.revenueByCurrency[currency] = (current.revenueByCurrency[currency] ?? 0) + parseFloat(booking.total);
    current.bookings += 1;
    propertyRevenue.set(prop.id, current);
  }

  const topProperties = Array.from(propertyRevenue.entries())
    .sort((a, b) => {
      const av = sumByCurrencyConverted(Object.entries(a[1].revenueByCurrency).map(([currency, amount]) => ({ currency, amount })), targetCurrency).total;
      const bv = sumByCurrencyConverted(Object.entries(b[1].revenueByCurrency).map(([currency, amount]) => ({ currency, amount })), targetCurrency).total;
      return bv - av;
    })
    .slice(0, 5)
    .map(([id, data]) => ({
      id,
      ...data,
      displayCurrency: targetCurrency,
      displayRevenue: sumByCurrencyConverted(
        Object.entries(data.revenueByCurrency).map(([currency, amount]) => ({ currency, amount })),
        targetCurrency,
      ).total,
    }));

  return {
    period,
    // Devise de comparaison (dominante de la période) — exposée pour que
    // l'export CSV nomme la devise des montants agrégés au lieu de les
    // présenter comme une somme toutes devises confondues.
    comparisonCurrency,
    displayCurrency: targetCurrency,
    unknownCurrencies,
    chartDays,
    chartFrom,
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
    occupiedNights,
    potentialNights,
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

function civilDayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}
