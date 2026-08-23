import { NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

/** Export opérationnel, pas une facture légale ni un état de payout. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "Accès hébergeur ou admin requis" }, { status: 403 });
  }
  const condition = user.role === "admin"
    ? and(eq(bookings.paymentStatus, "paid"), ne(bookings.status, "cancelled"))
    : and(
        eq(properties.hostId, user.id),
        eq(bookings.paymentStatus, "paid"),
        ne(bookings.status, "cancelled"),
      );
  const rows = await db
    .select({ booking: bookings, propertyName: properties.name })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .where(condition)
    .orderBy(bookings.createdAt);

  const lines = [
    ["Référence", "Hébergement", "Créé le", "Arrivée", "Départ", "Total", "Commission", "Net hôte", "Devise", "Statut paiement"],
    ...rows.map(({ booking, propertyName }) => [booking.bookingReference, propertyName, booking.createdAt.toISOString(), booking.checkIn, booking.checkOut, booking.total, booking.commissionAmount, booking.netToHost, booking.currency, booking.paymentStatus]),
  ];
  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"mybestbooking-revenus.csv\"",
      "Cache-Control": "private, no-store",
    },
  });
}
