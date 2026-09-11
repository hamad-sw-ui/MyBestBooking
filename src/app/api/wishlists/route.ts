import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wishlists, wishlistItems, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, zodErrorResponse } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { apiError } from "@/lib/api-error";
import { assertNotMaintenance, MaintenanceError, maintenanceResponse } from "@/lib/maintenance";

const createWishlistSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  isPublic: z.boolean().optional(),
}).strict()

const addItemSchema = z.object({
  wishlistId: z.string().uuid(),
  propertyId: z.string().uuid(),
}).strict()

const updateWishlistSchema = z.object({
  wishlistId: z.string().uuid(),
  isPublic: z.boolean().optional(),
  rotateShareToken: z.boolean().optional(),
  // T-246 (audit n°5, A1) : renommage d'une liste — champ **optionnel**, donc
  // les appels existants (partage, rotation) sont inchangés.
  name: z.string().trim().min(1, "Le nom est requis").max(80, "Nom trop long (80 caractères maximum)").optional(),
}).strict()

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 401 }
      );
    }

    // T-246 : ordre **déterministe** (le cœur écrivait jusqu'ici dans
    // `wishlists[0]`, alors que la page affichait les listes par date
    // décroissante — le favori pouvait atterrir dans une autre liste que celle
    // affichée en premier).
    const userWishlists = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.userId, user.id))
      .orderBy(asc(wishlists.createdAt), asc(wishlists.id));

    const wishlistsWithItems = await Promise.all(
      userWishlists.map(async (wishlist) => {
        const items = await db
          .select({
            item: wishlistItems,
            property: properties,
          })
          .from(wishlistItems)
          .leftJoin(properties, eq(wishlistItems.propertyId, properties.id))
          .where(eq(wishlistItems.wishlistId, wishlist.id));

        return {
          ...wishlist,
          items: items.map(i => ({ item: i.item, property: i.property })),
          itemCount: items.length,
        };
      })
    );

    return NextResponse.json({
      wishlists: wishlistsWithItems,
      // Liste cible par défaut du cœur (première liste, ordre stable ci-dessus).
      defaultWishlistId: wishlistsWithItems[0]?.id ?? null,
    });
  } catch (error) {
    console.error("Error fetching wishlists:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 401 }
      );
    }
    await assertNotMaintenance(user);

    // T-028 : rate-limit — 60 ops wishlist/min/user (permet la
    // navigation rapide + ajout multiple, empêche le hammer).
    const rl = rateLimit(`wishlists:user:${user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: await apiError("Trop d'ajouts, ralentissez") },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const body = await request.json();

    // Check if adding to wishlist or creating new wishlist
    if (body.propertyId) {
      // Add property to wishlist
      const data = addItemSchema.parse(body);

      // Verify wishlist ownership
      const [wishlist] = await db
        .select()
        .from(wishlists)
        .where(and(eq(wishlists.id, data.wishlistId), eq(wishlists.userId, user.id)));

      if (!wishlist) {
        return NextResponse.json(
          { error: await apiError("Liste non trouvée") },
          { status: 404 }
        );
      }

      // T-127 (P1) : la propriété doit exister (propertyId est une clé
      // étrangère) ; sinon l'insertion lèverait une violation FK → 500.
      const [targetProperty] = await db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.id, data.propertyId))
        .limit(1);
      if (!targetProperty) {
        return NextResponse.json({ error: await apiError("Hébergement introuvable") }, { status: 404 });
      }

      // Check if already in wishlist
      const existing = await db
        .select()
        .from(wishlistItems)
        .where(
          and(
            eq(wishlistItems.wishlistId, data.wishlistId),
            eq(wishlistItems.propertyId, data.propertyId)
          )
        );

      if (existing.length > 0) {
        return NextResponse.json(
          { error: await apiError("Hébergement déjà dans la liste") },
          { status: 400 }
        );
      }

      const [newItem] = await db
        .insert(wishlistItems)
        .values({
          wishlistId: data.wishlistId,
          propertyId: data.propertyId,
        })
        .returning();

      return NextResponse.json({ item: newItem }, { status: 201 });
    } else {
      // Create new wishlist
      const data = createWishlistSchema.parse(body);

      const [newWishlist] = await db
        .insert(wishlists)
        .values({
          userId: user.id,
          name: data.name,
          isPublic: data.isPublic || false,
          shareToken: data.isPublic ? uuidv4() : null,
        })
        .returning();

      return NextResponse.json({ wishlist: newWishlist }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("Error creating wishlist:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    await assertNotMaintenance(user);
    const data = updateWishlistSchema.parse(await request.json());
    const [wishlist] = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.id, data.wishlistId), eq(wishlists.userId, user.id)));
    if (!wishlist) return NextResponse.json({ error: await apiError("Liste non trouvée") }, { status: 404 });

    const isPublic = data.isPublic ?? wishlist.isPublic ?? false;
    const shouldGenerateToken = isPublic && (!wishlist.shareToken || data.rotateShareToken);
    const [updated] = await db
      .update(wishlists)
      .set({
        isPublic,
        shareToken: isPublic ? (shouldGenerateToken ? uuidv4() : wishlist.shareToken) : null,
        // T-246 : renommage seulement si le champ est fourni (sinon inchangé).
        ...(data.name !== undefined ? { name: data.name } : {}),
      })
      .where(eq(wishlists.id, wishlist.id))
      .returning();
    return NextResponse.json({ wishlist: updated });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("Error updating wishlist:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 401 }
      );
    }
    await assertNotMaintenance(user);

    const { searchParams } = new URL(request.url);
    const wishlistId = searchParams.get("wishlistId");
    const propertyId = searchParams.get("propertyId");

    if (!wishlistId) {
      return NextResponse.json(
        { error: await apiError("wishlistId requis") },
        { status: 400 }
      );
    }
    if (!isUuid(wishlistId) || (propertyId !== null && !isUuid(propertyId))) {
      return NextResponse.json(
        { error: await apiError("Identifiant invalide") },
        { status: 400 },
      );
    }

    // Verify ownership
    const [wishlist] = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, user.id)));

    if (!wishlist) {
      return NextResponse.json(
        { error: await apiError("Liste non trouvée") },
        { status: 404 }
      );
    }

    if (propertyId) {
      // Remove item from wishlist
      await db
        .delete(wishlistItems)
        .where(
          and(
            eq(wishlistItems.wishlistId, wishlistId),
            eq(wishlistItems.propertyId, propertyId)
          )
        );
    } else {
      // Delete entire wishlist
      await db.delete(wishlistItems).where(eq(wishlistItems.wishlistId, wishlistId));
      await db.delete(wishlists).where(eq(wishlists.id, wishlistId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    console.error("Error deleting wishlist:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
  }
}
