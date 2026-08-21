import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { conversations, properties, bookings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq, or } from "drizzle-orm";

const createSchema = z.object({
  propertyId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
});

/**
 * GET /api/conversations — liste les conversations de l'utilisateur
 * (voyageur ou hôte).
 * POST /api/conversations { propertyId, bookingId? } — crée un thread
 * ou renvoie celui existant.
 * (T-015)
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Voyageur : ses conversations. Hôte : conversations sur ses properties.
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

    // Une seule conversation active par (user, property, booking?).
    const existing = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, user.id),
          eq(conversations.propertyId, data.propertyId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ conversation: existing[0] }, { status: 200 });
    }

    // Vérifier que la property existe
    const [prop] = await db.select().from(properties).where(eq(properties.id, data.propertyId));
    if (!prop) return NextResponse.json({ error: "Hébergement introuvable" }, { status: 404 });

    // Vérifier booking si fourni
    if (data.bookingId) {
      const [b] = await db.select().from(bookings).where(eq(bookings.id, data.bookingId));
      if (!b || b.userId !== user.id) {
        return NextResponse.json({ error: "Réservation invalide" }, { status: 400 });
      }
    }

    const [conv] = await db
      .insert(conversations)
      .values({
        propertyId: data.propertyId,
        userId: user.id,
        bookingId: data.bookingId ?? null,
      })
      .returning();

    return NextResponse.json({ conversation: conv }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("conversations POST error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
