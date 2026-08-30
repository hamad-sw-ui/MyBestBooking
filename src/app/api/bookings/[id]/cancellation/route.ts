import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { computeCancellationFeeWithGrid, daysUntil, type CancellationPolicy } from "@/lib/cancellation";
import { getSetting } from "@/lib/settings";

/** Devis lecture seule avant une annulation voyageur. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  const [row] = await db.select({ booking: bookings, property: properties }).from(bookings).leftJoin(properties, eq(bookings.propertyId, properties.id)).where(eq(bookings.id, id));
  if (!row) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  // T-156 : l'hôte du bien (ou l'admin) peut consulter le devis pour
  // annuler une réservation de son hébergement — remboursement intégral.
  const isHost = row.property?.hostId === user.id;
  if (row.booking.userId !== user.id && !isHost && user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (row.booking.status !== "confirmed" && row.booking.status !== "pending") {
    return NextResponse.json({ error: "Cette réservation ne peut plus être annulée" }, { status: 409 });
  }
  const byOperator = isHost || user.role === "admin";
  const snapshot = row.booking.ratePlanSnapshot as { cancellationPolicy?: string; cancellationFreeDays?: number | null } | null;
  const days = daysUntil(row.booking.checkIn);
  const fee = byOperator
    ? 0
    : (snapshot?.cancellationFreeDays ?? 0) > 0 && days >= (snapshot?.cancellationFreeDays ?? 0)
      ? 0
      : computeCancellationFeeWithGrid((snapshot?.cancellationPolicy ?? row.property?.cancellationPolicy ?? "flexible") as CancellationPolicy, Number(row.booking.total), days, await getSetting("cancellation"));
  return NextResponse.json({
    bookingId: row.booking.id,
    total: row.booking.total,
    currency: row.booking.currency,
    cancellationFee: fee.toFixed(2),
    estimatedRefund: Math.max(0, Number(row.booking.total) - fee).toFixed(2),
    daysBeforeCheckIn: days,
    // T-156 : renseigné uniquement pour un acteur hôte/admin (le devis
    // voyageur reste facturé selon la politique — champ absent = ancien
    // comportement, aucun client existant ne lit ce champ).
    ...(byOperator ? { actor: user.role === "admin" ? "admin" : "host", fullRefund: true } : {}),
  });
}
