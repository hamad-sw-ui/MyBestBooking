import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, reviewVotes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { and, eq, sql } from "drizzle-orm";

/**
 * POST /api/reviews/[id]/helpful — utilisateur connecté (T-026 audit).
 *
 * Vote « utile » unique par (review, user) : la contrainte d'unicité en base
 * empêche le double comptage. Un re-vote renvoie 409 (T-126). Un rate-limit
 * haut débit complète le dispositif contre le spam.
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
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    // T-126 (P2) : un vote déjà enregistré est un état définitif → 409
    // Conflict, vérifié AVANT le rate-limit pour qu'un re-clic (même après
    // 24 h) réponde toujours « déjà voté » plutôt qu'un 429 « réessayez ».
    const [existingVote] = await db
      .select({ id: reviewVotes.id })
      .from(reviewVotes)
      .where(and(eq(reviewVotes.reviewId, id), eq(reviewVotes.userId, user.id)))
      .limit(1);
    if (existingVote) {
      return NextResponse.json({ error: "Vous avez déjà marqué cet avis comme utile" }, { status: 409 });
    }

    // Rate-limit anti-spam : un même user ne peut incrémenter le même avis
    // qu'une fois toutes les 24h (garde haut débit, en plus de la contrainte
    // d'unicité ci-dessus).
    const rl = rateLimit(`helpful:${user.id}:${id}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop d'actions, réessayez plus tard" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const result = await db.transaction(async (tx) => {
      const [review] = await tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.id, id));
      if (!review) return { missing: true as const };
      const inserted = await tx
        .insert(reviewVotes)
        .values({ reviewId: id, userId: user.id })
        .onConflictDoNothing({ target: [reviewVotes.reviewId, reviewVotes.userId] })
        .returning({ id: reviewVotes.id });
      if (!inserted.length) return { duplicate: true as const };
      const [updated] = await tx
        .update(reviews)
        .set({ helpfulCount: sql`${reviews.helpfulCount} + 1` })
        .where(eq(reviews.id, id))
        .returning({ id: reviews.id, helpfulCount: reviews.helpfulCount });
      return { review: updated };
    });
    if ("missing" in result) return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    // T-126 (P2) : l'utilisateur a déjà voté → 409 Conflict (état attendu et
    // définitif), pas 429 (« réessayez plus tard ») qui laissait croire à une
    // limitation temporaire. Le 429 reste réservé au vrai spam (rate-limit
    // en amont, plusieurs actions rapprochées).
    if ("duplicate" in result) return NextResponse.json({ error: "Vous avez déjà marqué cet avis comme utile" }, { status: 409 });
    return NextResponse.json({ review: result.review });
  } catch (error) {
    console.error("[reviews/helpful] error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
