import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { makeT } from "@/lib/ui-strings";
import { getServerLocale } from "@/lib/server-locale";
import { convertAmount, indicativeRate, isDisplayCurrency, FX_SNAPSHOT } from "@/lib/i18n";
import { getServerDisplayCurrency } from "@/lib/server-display-currency";
import { csvRows } from "@/lib/csv";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Export opérationnel, pas une facture légale ni un état de payout. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: await apiError("Accès hébergeur ou admin requis") }, { status: 403 });
  }

  // T-127 (P3) : filtre optionnel par période de création (from/to, YYYY-MM-DD).
  // Sans paramètre, comportement historique : export complet.
  const filters = [
    eq(bookings.paymentStatus, "paid"),
    ne(bookings.status, "cancelled"),
  ];
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (from !== null || to !== null) {
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to)) || (from && to && from > to)) {
      return NextResponse.json({ error: await apiError("Période invalide (from/to au format YYYY-MM-DD, from ≤ to)") }, { status: 400 });
    }
    if (from) filters.push(gte(bookings.createdAt, new Date(`${from}T00:00:00.000Z`)));
    if (to) filters.push(lte(bookings.createdAt, new Date(`${to}T23:59:59.999Z`)));
  }

  const condition = user.role === "admin"
    ? and(...filters)
    : and(
        eq(properties.hostId, user.id),
        ...filters,
      );
  const rows = await db
    .select({ booking: bookings, propertyName: properties.name })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .where(condition)
    .orderBy(bookings.createdAt);

  // Les colonnes natives restent la source opérationnelle. Les colonnes
  // `*_display` sont additives, indicatives et reproductibles avec la devise
  // cible du compte ; une devise source inconnue laisse ces colonnes vides.
  const displayCurrency = await getServerDisplayCurrency(user.currency);
  const displayAmount = (value: string, sourceCurrency: string | null) => {
    const source = (sourceCurrency ?? "EUR").toUpperCase();
    if (!isDisplayCurrency(source) || !isDisplayCurrency(displayCurrency)) return "";
    return convertAmount(Number(value), source, displayCurrency).toFixed(2);
  };
  const displayRate = (sourceCurrency: string | null) => {
    const source = (sourceCurrency ?? "EUR").toUpperCase();
    const rate = indicativeRate(source, displayCurrency);
    return rate === null ? "" : rate.toFixed(8);
  };
  const t = makeT(await getServerLocale());
  const lines = [
    [
      t("billingCsv.reference"),
      t("billingCsv.property"),
      t("billingCsv.createdAt"),
      t("billingCsv.checkIn"),
      t("billingCsv.checkOut"),
      t("billingCsv.total"),
      t("billingCsv.commission"),
      t("billingCsv.netToHost"),
      t("billingCsv.currency"),
      t("billingCsv.paymentStatus"),
      t("billingCsv.totalDisplay"),
      t("billingCsv.commissionDisplay"),
      t("billingCsv.netToHostDisplay"),
      t("billingCsv.displayCurrency"),
      t("billingCsv.displayRate"),
      t("billingCsv.displayRateAsOf"),
    ],
    ...rows.map(({ booking, propertyName }) => [
      booking.bookingReference,
      propertyName,
      booking.createdAt.toISOString(),
      booking.checkIn,
      booking.checkOut,
      booking.total,
      booking.commissionAmount,
      booking.netToHost,
      booking.currency,
      booking.paymentStatus,
      displayAmount(booking.total, booking.currency),
      displayAmount(booking.commissionAmount, booking.currency),
      displayAmount(booking.netToHost, booking.currency),
      displayCurrency,
      displayRate(booking.currency),
      displayRate(booking.currency) ? FX_SNAPSHOT.asOf : "",
    ]),
  ];
  const csv = csvRows(lines);
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"MyBestBooking-revenus.csv\"",
      "Cache-Control": "private, no-store",
    },
  });
}
