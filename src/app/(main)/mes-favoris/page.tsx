import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { wishlists, wishlistItems, properties } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PropertyCard } from "@/components/property-card";
import { Heart, Plus, Share2, Trash2, Bell, FolderPlus } from "lucide-react";
import Link from "next/link";

async function getWishlists(userId: string) {
  const userWishlists = await db
    .select()
    .from(wishlists)
    .where(eq(wishlists.userId, userId))
    .orderBy(desc(wishlists.createdAt));

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
        items: items.map(i => i.property).filter(Boolean),
        itemCount: items.length,
      };
    })
  );

  return wishlistsWithItems;
}

export default async function FavoritesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/connexion");
  }

  const userWishlists = await getWishlists(user.id);

  // Get all favorite properties across all wishlists
  const allFavoriteProperties = userWishlists.flatMap(w => w.items);

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Mes favoris
            </h1>
            <p className="text-gray-600 mt-1">
              {allFavoriteProperties.length} hébergement{allFavoriteProperties.length !== 1 ? "s" : ""} sauvegardé{allFavoriteProperties.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button variant="outline">
            <FolderPlus className="w-4 h-4 mr-2" />
            Nouvelle liste
          </Button>
        </div>

        {userWishlists.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Heart className="w-8 h-8" />}
              title="Aucun favori"
              description="Sauvegardez vos hébergements préférés pour les retrouver facilement"
              action={
                <Link href="/recherche">
                  <Button>Explorer les hébergements</Button>
                </Link>
              }
              className="py-16"
            />
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Quick actions */}
            <div className="flex flex-wrap gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <Bell className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Alertes prix</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <Share2 className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Partager une liste</span>
              </button>
            </div>

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
                  <div className="flex items-center gap-2">
                    {wishlist.isPublic && (
                      <Button variant="ghost" size="sm">
                        <Share2 className="w-4 h-4 mr-2" />
                        Partager
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
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
                      property && <PropertyCard key={property.id} property={property} />
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
              <h3 className="font-semibold text-blue-900">Alertes prix</h3>
              <p className="text-sm text-blue-700 mt-1">
                Activez les alertes pour être notifié quand le prix d&apos;un de vos favoris baisse.
                Vous recevrez un email dès qu&apos;une bonne affaire se présente !
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
