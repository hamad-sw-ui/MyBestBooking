import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { resumePaymentIntentForBooking } from "@/lib/payment-intents";

/** Reprise propriétaire d’un hold payment, sans nouvel inventory booking. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { id } = await params;
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return NextResponse.json({ error: "Réservation non trouvée" }, { status: 404 });
    if (booking.userId !== user.id && user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const payment = await resumePaymentIntentForBooking(id);
    if (!payment) return NextResponse.json({ error: "Ce paiement ne peut plus être repris" }, { status: 409 });
    if (payment.status !== "succeeded" && !payment.clientSecret && payment.provider === "stripe") {
      return NextResponse.json({ error: "Le prestataire n'a pas retourné de formulaire de paiement" }, { status: 502 });
    }
    return NextResponse.json({ booking: payment.booking, payment: {
      provider: payment.provider,
      status: payment.status,
      clientSecret: payment.clientSecret,
      requiresConfirmation: payment.status !== "succeeded",
    } });
  } catch (error) {
    console.error("[bookings/payment]", error);
    return NextResponse.json({ error: "Impossible de reprendre le paiement" }, { status: 502 });
  }
}
