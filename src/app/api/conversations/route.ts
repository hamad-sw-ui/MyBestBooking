import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { conversations, properties, bookings } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({
  propertyId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
});

/**
 * GET : conversations du voyageur ou de l'hôte.
 * POST : ouvre le fil lié à une réservation. Un voyageur ouvre son propre
 * fil ; un hôte ouvre celui du voyageur ayant réservé son hébergement.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const rows = await db
    .select({ conversation: conversations, property: properties })
    .from(conversations)
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .where(or(eq(conversations.userId, user.id), eq(properties.hostId, user.id)));
  return NextResponse.json({ conversations: rows });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const data = createSchema.parse(await request.json());

    const [property] = await db.select().from(properties).where(eq(properties.id, data.propertyId));
    if (!property) return NextResponse.json({ error: "Hébergement introuvable" }, { status: 404 });

    let participantUserId = user.id;
    if (data.bookingId) {
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, data.bookingId));
      if (!booking || booking.propertyId !== property.id) {
        return NextResponse.json({ error: "Réservation invalide" }, { status: 400 });
      }
      if (property.hostId === user.id) {
        participantUserId = booking.userId;
      } else if (booking.userId !== user.id) {
        return NextResponse.json({ error: "Réservation invalide" }, { status: 403 });
      }
    } else if (property.hostId === user.id) {
      return NextResponse.json({ error: "Un hôte doit sélectionner une réservation pour ouvrir une conversation" }, { status: 400 });
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
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    console.error("conversations POST error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
