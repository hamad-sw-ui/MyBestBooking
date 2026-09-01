import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wishlists, wishlistItems, properties } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";

/**
 * GET /api/wishlists/shared/[token] — accès public à une wishlist
 * `isPublic:true` via son shareToken. N'expose ni le userId ni les
 * infos privées. (T-015)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const [wl] = await db
    .select()
    .from(wishlists)
    .where(and(eq(wishlists.shareToken, token), eq(wishlists.isPublic, true)))
    .limit(1);

  if (!wl) return NextResponse.json({ error: await apiError("Introuvable") }, { status: 404 });

  const items = await db
    .select({
      property: {
        id: properties.id,
        slug: properties.slug,
        name: properties.name,
        city: properties.city,
        country: properties.country,
        mainImage: properties.mainImage,
        starRating: properties.starRating,
        averageRating: properties.averageRating,
      },
      addedAt: wishlistItems.addedAt,
    })
    .from(wishlistItems)
    .leftJoin(properties, eq(wishlistItems.propertyId, properties.id))
    .where(eq(wishlistItems.wishlistId, wl.id));

  return NextResponse.json({
    name: wl.name,
    itemCount: items.length,
    items,
  });
}
