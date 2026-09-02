import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { makeT } from "@/lib/ui-strings";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  // Neutralise les formules Excel/LibreOffice provenant d'un nom de property
  // saisi par un hôte, sans modifier les montants ni références métiers.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

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

  // En-têtes localisés dans la langue du compte (fr/en) — UIT : tout libellé
  // exposé passe par le dictionnaire `ui-strings`.
  const t = makeT(user.language);
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
    ],
    ...rows.map(({ booking, propertyName }) => [booking.bookingReference, propertyName, booking.createdAt.toISOString(), booking.checkIn, booking.checkOut, booking.total, booking.commissionAmount, booking.netToHost, booking.currency, booking.paymentStatus]),
  ];
  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"MyBestBooking-revenus.csv\"",
      "Cache-Control": "private, no-store",
    },
  });
}
