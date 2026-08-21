import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { eq, sql } from "drizzle-orm";

/**
 * POST /api/reviews/[id]/helpful — utilisateur connecté (T-026 audit).
 *
 * Incrémente atomiquement `reviews.helpful_count`. Rate-limit par
 * user pour éviter le spam. Un futur schéma pourrait stocker le vote
 * pour empêcher le double comptage — pour l'instant on garde simple
 * (rate-limit strict par user + review).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    // Rate-limit : un même user ne peut incrémenter le même avis qu'une
    // fois toutes les 24h (approximation « anti double clic »).
    const rl = rateLimit(`helpful:${user.id}:${id}`, {
      limit: 1,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Vous avez déjà marqué cet avis comme utile" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const [updated] = await db
      .update(reviews)
      .set({ helpfulCount: sql`${reviews.helpfulCount} + 1` })
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id, helpfulCount: reviews.helpfulCount });

    if (!updated) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    return NextResponse.json({ review: updated });
  } catch (error) {
    console.error("[reviews/helpful] error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
