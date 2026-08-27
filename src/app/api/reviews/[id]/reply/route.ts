import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { reviews, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { and, eq } from "drizzle-orm";

const schema = z.object({ reply: z.string().min(1).max(2000) });

/**
 * POST /api/reviews/[id]/reply — réponse de l'hôte à un avis.
 * Uniquement le host propriétaire de la property de l'avis peut poster.
 * Écrase la réponse précédente s'il y en a une.
 * (T-015)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }
    const { reply } = schema.parse(await request.json());

    const [row] = await db
      .select({ review: reviews, property: properties })
      .from(reviews)
      .leftJoin(properties, eq(reviews.propertyId, properties.id))
      .where(eq(reviews.id, id))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    if (row.property?.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const [updated] = await db
      .update(reviews)
      .set({ hostReply: reply, hostReplyAt: new Date() })
      .where(eq(reviews.id, id))
      .returning();

    return NextResponse.json({ review: updated });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("review reply error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
