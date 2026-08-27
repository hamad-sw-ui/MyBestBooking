import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { recomputePropertyReviewAggregate } from "@/lib/review-aggregates";

const schema = z.object({
  status: z.enum(["approved", "pending", "hidden", "rejected"]),
  moderationReason: z.string().max(500).optional(),
});

/**
 * PATCH /api/reviews/[id]/moderate — admin uniquement (T-023).
 *
 * Change `reviews.status`, puis recalcule atomiquement
 * `properties.averageRating` et `properties.totalReviews` en ne
 * comptant que les avis `status='approved'` — même expression SQL
 * que POST /api/reviews (T-007), cohérence garantie.
 *
 * Log de traçabilité minimal (sera intégré à `audit_log` T-024).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
    }

    const rl = rateLimit(`admin:review-moderate:${user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop de modérations, réessayez dans une minute" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
    }
    const { status } = schema.parse(body);

    // Transaction : update status + recalcul agrégat property.
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(reviews)
        .where(eq(reviews.id, id));
      if (!existing) return { notFound: true as const };

      const previousStatus = existing.status;
      const [updated] = await tx
        .update(reviews)
        .set({ status, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();

      await recomputePropertyReviewAggregate(tx, existing.propertyId);

      return { review: updated, previousStatus };
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    // T-024 : audit log
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.reviewModerate,
      entityType: "review",
      entityId: id,
      metadata: { from: result.previousStatus, to: status },
    });
    return NextResponse.json({ review: result.review });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Payload invalide" },
        { status: 400 },
      );
    }
    console.error("review moderate error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
