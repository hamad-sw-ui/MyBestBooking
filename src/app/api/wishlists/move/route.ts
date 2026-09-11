import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wishlists, wishlistItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { zodErrorResponse } from "@/lib/http";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { assertNotMaintenance, MaintenanceError, maintenanceResponse } from "@/lib/maintenance";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/wishlists/move — T-246 (audit n°5, A1).
 *
 * Déplace un favori d'une liste à une autre. Le couple (liste, bien) est
 * unique : on insère la cible puis on supprime la source **dans la même
 * transaction** — un déplacement ne peut donc pas perdre le favori ni le
 * dupliquer, même en cas d'erreur au milieu.
 *
 * Réponse : `{ moved: true, toWishlistId }`. Erreurs : 400 (corps/paramètres),
 * 404 (liste inconnue ou non possédée — aucune information sur les listes d'un
 * tiers), 400 « déjà dans la liste » si le bien est déjà dans la cible.
 */
const schema = z
  .object({
    propertyId: z.string().uuid(),
    fromWishlistId: z.string().uuid(),
    toWishlistId: z.string().uuid(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.fromWishlistId === data.toWishlistId) {
      ctx.addIssue({
        code: "custom",
        path: ["toWishlistId"],
        message: "La liste de destination doit être différente",
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    }
    await assertNotMaintenance(user);

    const rl = rateLimit(`wishlists:user:${user.id}`, { limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: await apiError("Trop d'ajouts, ralentissez") },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") },
        { status: 400 },
      );
    }
    const data = schema.parse(body);

    // Les deux listes doivent appartenir au même utilisateur : une liste
    // inconnue ou appartenant à un tiers est indiscernable (404 identique).
    const owned = await db
      .select({ id: wishlists.id })
      .from(wishlists)
      .where(
        and(
          eq(wishlists.userId, user.id),
          eq(wishlists.id, data.fromWishlistId),
        ),
      );
    const ownedTarget = await db
      .select({ id: wishlists.id })
      .from(wishlists)
      .where(and(eq(wishlists.userId, user.id), eq(wishlists.id, data.toWishlistId)));
    if (owned.length === 0 || ownedTarget.length === 0) {
      return NextResponse.json({ error: await apiError("Liste non trouvée") }, { status: 404 });
    }

    const alreadyThere = await db
      .select({ id: wishlistItems.id })
      .from(wishlistItems)
      .where(
        and(
          eq(wishlistItems.wishlistId, data.toWishlistId),
          eq(wishlistItems.propertyId, data.propertyId),
        ),
      );
    if (alreadyThere.length > 0) {
      return NextResponse.json(
        { error: await apiError("Hébergement déjà dans la liste") },
        { status: 400 },
      );
    }

    const moved = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(wishlistItems)
        .values({
          wishlistId: data.toWishlistId,
          propertyId: data.propertyId,
        })
        .returning({ id: wishlistItems.id });
      // Rien à déplacer si le favori n'était pas dans la liste source : on
      // annule l'insertion pour ne pas créer un favori au passage.
      if (!inserted) throw new Error("MOVE_FAILED");
      const [deleted] = await tx
        .delete(wishlistItems)
        .where(
          and(
            eq(wishlistItems.wishlistId, data.fromWishlistId),
            eq(wishlistItems.propertyId, data.propertyId),
          ),
        )
        .returning({ id: wishlistItems.id });
      if (!deleted) throw new Error("NOT_IN_SOURCE_LIST");
      return inserted.id;
    });

    return NextResponse.json({ moved: true, itemId: moved, toWishlistId: data.toWishlistId });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") },
        { status: 400 },
      );
    }
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    if (error instanceof Error && error.message === "NOT_IN_SOURCE_LIST") {
      return NextResponse.json(
        { error: await apiError("Ce favori n'est pas dans la liste d'origine") },
        { status: 404 },
      );
    }
    console.error("[wishlists/move] POST", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
