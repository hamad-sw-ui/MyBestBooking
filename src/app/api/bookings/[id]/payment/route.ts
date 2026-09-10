import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";

/**
 * T-207 — Le produit ne propose plus de paiement dans la plateforme.
 *
 * La route legacy reste présente pour ne pas transformer d'anciens liens en
 * 404 ambigu, mais elle ne crée/reprend plus jamais d'intent PSP. Après les
 * gardes d'auth/propriété, elle répond 410 avec un message explicite.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return NextResponse.json({ error: await apiError("Réservation non trouvée") }, { status: 404 });
    if (booking.userId !== user.id && user.role !== "admin") return NextResponse.json({ error: await apiError("Accès refusé") }, { status: 403 });
    return NextResponse.json(
      { error: await apiError("Le paiement en ligne est désactivé : suivez cette réservation depuis Mes réservations ou contactez l'hôte."), code: "ONLINE_PAYMENT_DISABLED" },
      { status: 410 },
    );
  } catch (error) {
    console.error("[bookings/payment]", error);
    return NextResponse.json({ error: await apiError("Impossible de traiter la demande") }, { status: 500 });
  }
}
