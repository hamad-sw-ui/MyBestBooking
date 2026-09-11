import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { conversations, properties, bookings, messages } from "@/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { zodErrorResponse } from "@/lib/http";
import { apiError } from "@/lib/api-error";
import { assertNotMaintenance, MaintenanceError, maintenanceResponse } from "@/lib/maintenance";

const createSchema = z.object({
  propertyId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
}).strict()

/**
 * GET : conversations du voyageur ou de l'hôte.
 * POST : ouvre le fil lié à une réservation. Un voyageur ouvre son propre
 * fil ; un hôte ouvre celui du voyageur ayant réservé son hébergement.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
  const rows = await db
    .select({ conversation: conversations, property: properties })
    .from(conversations)
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .where(and(
      // T-206/F9 : GET liste seulement les conversations ayant au moins un
      // message. POST continue de retourner immédiatement le fil ouvert.
      sql`EXISTS (SELECT 1 FROM ${messages} msg WHERE msg.conversation_id = ${conversations.id})`,
      ...(user.role === "admin" ? [] : [or(eq(conversations.userId, user.id), eq(properties.hostId, user.id))!]),
    ));
  return NextResponse.json({ conversations: rows });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    await assertNotMaintenance(user);
    const data = createSchema.parse(await request.json());

    const [property] = await db.select().from(properties).where(eq(properties.id, data.propertyId));
    if (!property) return NextResponse.json({ error: await apiError("Hébergement introuvable") }, { status: 404 });

    let participantUserId = user.id;
    if (data.bookingId) {
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, data.bookingId));
      if (!booking || booking.propertyId !== property.id) {
        return NextResponse.json({ error: await apiError("Réservation invalide") }, { status: 400 });
      }
      if (property.hostId === user.id) {
        participantUserId = booking.userId;
      } else if (booking.userId !== user.id) {
        return NextResponse.json({ error: await apiError("Réservation invalide") }, { status: 403 });
      }
    } else if (property.hostId === user.id) {
      return NextResponse.json({ error: await apiError("Un hôte doit sélectionner une réservation pour ouvrir une conversation") }, { status: 400 });
    }

    const conversationKey = data.bookingId
      ? `booking:${data.bookingId}`
      : `property:${data.propertyId}:user:${participantUserId}`;
    await db.insert(conversations).values({
      conversationKey,
      propertyId: data.propertyId,
      userId: participantUserId,
      bookingId: data.bookingId ?? null,
    }).onConflictDoNothing({ target: conversations.conversationKey });
    const [conversation] = await db.select().from(conversations)
      .where(eq(conversations.conversationKey, conversationKey)).limit(1);
    if (!conversation) throw new Error("CONVERSATION_CREATE_FAILED");
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("conversations POST error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
