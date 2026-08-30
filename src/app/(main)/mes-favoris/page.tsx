import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { wishlists, wishlistItems, properties } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PropertyCard } from "@/components/property-card";
import { WishlistActions } from "@/components/wishlist-actions";
import { CreateWishlistButton } from "@/components/create-wishlist-button";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { aggregateWishlistItems, uniqueProperties } from "@/lib/wishlist-utils";
import { PriceAlertsSection } from "@/components/price-alerts-section";
import { Heart, Bell } from "lucide-react";
import Link from "next/link";

/**
 * T-160 (audit n°30) — « Mes favoris » : 2 requêtes au lieu de 1 + N
 * (une par liste → 124 requêtes avec 123 listes d'artefacts), avec le
 * compteur d'items réel par liste ET les propriétés uniques de l'utilisateur
 * (un bien présent dans plusieurs listes n'est plus compté 2×).
 */
async function getWishlists(userId: string) {
  const userWishlists = await db
    .select()
    .from(wishlists)
    .where(eq(wishlists.userId, userId))
    .orderBy(desc(wishlists.createdAt));

  const ids = userWishlists.map((w) => w.id);
  const itemsRows = ids.length
    ? await db
        .select({ wishlistId: wishlistItems.wishlistId, property: properties })
        .from(wishlistItems)
        .leftJoin(properties, eq(wishlistItems.propertyId, properties.id))
        .where(
          ids.length === 1
            ? eq(wishlistItems.wishlistId, ids[0]!)
            : (await import("drizzle-orm")).inArray(wishlistItems.wishlistId, ids),
        )
        .orderBy(desc(wishlistItems.addedAt))
    : [];

  const byId = aggregateWishlistItems(
    ids,
    itemsRows.map((r) => ({ wishlistId: r.wishlistId, property: r.property })),
  );

  return userWishlists.map((wishlist) => ({
    ...wishlist,
    items: byId.get(wishlist.id)?.items ?? [],
    itemCount: byId.get(wishlist.id)?.itemCount ?? 0,
  }));
}

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  const t = makeT(await getServerLocale());

  if (!user) {
    redirect("/connexion");
  }

  const userWishlists = await getWishlists(user.id);

  // Get all favorite properties across all wishlists (T-160 : dédupliqué,
  // un bien présent dans plusieurs listes n'est compté qu'une fois).
  const allFavoriteProperties = uniqueProperties(userWishlists.flatMap(w => w.items));

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {t("fav.title")}
            </h1>
            <p className="text-gray-600 mt-1">
              {allFavoriteProperties.length} {allFavoriteProperties.length === 1 ? t("fav.countOne") : t("fav.countMany")}
            </p>
          </div>
          <CreateWishlistButton />
        </div>

        {userWishlists.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Heart className="w-8 h-8" />}
              title={t("fav.emptyTitle")}
              description={t("fav.emptyDesc")}
              action={
                <Link href="/recherche">
                  <Button>{t("bookings.explore")}</Button>
                </Link>
              }
              className="py-16"
            />
          </Card>
        ) : (
          <div className="space-y-8">
            {/* T-031 : liste des alertes prix réellement branchée */}
            <PriceAlertsSection
              properties={allFavoriteProperties
                .filter((p): p is NonNullable<typeof p> => p !== null)
                .map((p) => ({
                  id: p.id,
                  name: p.name,
                  city: p.city,
                }))}
            />

            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Bell className="w-3 h-3" />
              {t("fav.alertsManaged")}
            </p>

            {/* Wishlists */}
            {userWishlists.map((wishlist) => (
              <div key={wishlist.id}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {wishlist.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {wishlist.itemCount} hébergement{wishlist.itemCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <WishlistActions
                    wishlistId={wishlist.id}
                    isPublic={wishlist.isPublic ?? false}
                    shareToken={wishlist.shareToken}
                  />
                </div>

                {wishlist.items.length === 0 ? (
                  <Card className="bg-gray-50">
                    <CardContent className="text-center py-8">
                      <Heart className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-gray-500">Cette liste est vide</p>
                      <Link href="/recherche">
                        <Button variant="outline" className="mt-4" size="sm">
                          Ajouter des hébergements
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {wishlist.items.map((property) => (
                      property && (
                        <PropertyCard
                          key={property.id}
                          property={property}
                          showFavorite={false}
                          removeFavoriteFrom={{ wishlistId: wishlist.id }}
                        />
                      )
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* If no wishlists but we want to show all favorites */}
            {userWishlists.length === 0 && allFavoriteProperties.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Tous les favoris
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {allFavoriteProperties.map((property) => (
                    property && <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Price Alert Info */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">{t("fav.priceAlertsTitle")}</h3>
              <p className="text-sm text-blue-700 mt-1">
                {t("fav.priceAlertsDesc")}
                Vous recevrez un email dès qu&apos;une bonne affaire se présente !
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
