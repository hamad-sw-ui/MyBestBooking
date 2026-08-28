"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, Heart, Loader2 } from "lucide-react";
import { formatPrice, getRatingLabel, getPropertyTypeLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PublicPropertyCard } from "@/lib/public-property";
import { convertAmount, formatMoney } from "@/lib/i18n";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { uiStrings } from "@/lib/ui-strings";

interface PropertyCardProps {
  property: PublicPropertyCard;
  showFavorite?: boolean;
  /** Critères de séjour à préserver entre résultat de recherche et fiche. */
  searchQuery?: string;
}

export function PropertyCardClient({ property, showFavorite = true, searchQuery }: PropertyCardProps) {
  const [favoriteState, setFavoriteState] = useState<"idle" | "loading" | "saved">("idle");
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const rating = property.averageRating ? parseFloat(property.averageRating) : null;
  const ratingInfo = rating ? getRatingLabel(rating) : null;

  // T-131/T-132 : préférences d'affichage (devise = XAF par défaut plateforme,
  // langue). L'aperçu des prix est converti dans la devise d'affichage ; les
  // paiements restent dans la devise de la chambre.
  const { currency: displayCurrency, language } = useDisplayPreferences();
  const t = uiStrings(language);
  const sourceCurrency = property.minCurrency ?? "EUR";
  const rawPrice = property.minPrice;
  const showPrice = rawPrice !== null && rawPrice !== undefined;
  const priceText = (() => {
    if (!showPrice) return null;
    const numeric = typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice);
    if (!displayCurrency || displayCurrency === sourceCurrency.toUpperCase()) {
      return formatPrice(numeric, sourceCurrency);
    }
    // Taux figés V1 (i18n RATES_FROM_EUR) : indique une conversion approximative.
    return formatMoney(convertAmount(numeric, sourceCurrency, displayCurrency), displayCurrency);
  })();
  const isConverted = showPrice && Boolean(displayCurrency) && displayCurrency !== sourceCurrency.toUpperCase();

  async function addToFavorites(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (favoriteState === "loading" || favoriteState === "saved") return;

    setFavoriteState("loading");
    setFavoriteError(null);
    try {
      const listsResponse = await fetch("/api/wishlists");
      if (listsResponse.status === 401) {
        window.location.href = "/connexion?next=%2Frecherche";
        return;
      }
      if (!listsResponse.ok) throw new Error("Impossible de charger vos favoris");
      const listsData = await listsResponse.json();
      let wishlist = listsData.wishlists?.[0];

      if (!wishlist) {
        const createResponse = await fetch("/api/wishlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Mes favoris" }),
        });
        if (!createResponse.ok) throw new Error("Impossible de créer votre liste");
        wishlist = (await createResponse.json()).wishlist;
      }

      const addResponse = await fetch("/api/wishlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlistId: wishlist.id, propertyId: property.id }),
      });
      if (!addResponse.ok) {
        const data = await addResponse.json().catch(() => ({}));
        if (!String(data.error).includes("déjà")) throw new Error(data.error ?? "Impossible d'ajouter le favori");
      }
      setFavoriteState("saved");
    } catch (error) {
      setFavoriteState("idle");
      setFavoriteError(error instanceof Error ? error.message : "Erreur");
    }
  }

  return (
    <Link
      href={`/hebergement/${property.slug}${searchQuery ? `?${searchQuery}` : ""}`}
      className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={property.mainImage || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400"}
          alt={property.name}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {showFavorite && (
          <button
            onClick={addToFavorites}
            aria-label={favoriteState === "saved" ? t["fav.added"] : t["fav.add"]}
            title={favoriteError ?? (favoriteState === "saved" ? t["fav.added"] : t["fav.add"])}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
          >
            {favoriteState === "loading" ? <Loader2 className="w-5 h-5 text-gray-600 animate-spin" /> : <Heart className={`w-5 h-5 ${favoriteState === "saved" ? "fill-[#FF5A5F] text-[#FF5A5F]" : "text-gray-600"}`} aria-hidden="true" />}
          </button>
        )}
        {property.isBestrewards && (
          <div className="absolute top-3 left-3">
            <Badge variant="bestrewards">💎 BestRewards</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {property.name}
              {property.starRating && (
                <span className="ml-1 text-[#F5A623]">
                  {"★".repeat(property.starRating)}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              {property.city}, {property.country}
            </p>
          </div>
          {rating && (
            <div className="text-right shrink-0">
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#1B3A6B] text-white text-sm font-semibold rounded">
                {rating.toFixed(1)}
              </div>
              {property.totalReviews && property.totalReviews > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {property.totalReviews} {t["card.reviews"]}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
          <span className="px-2 py-0.5 bg-gray-100 rounded">
            {getPropertyTypeLabel(property.type)}
          </span>
          {property.isEcoCertified && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
              🌱 Éco
            </span>
          )}
        </div>

        <div className="flex items-end justify-between pt-3 border-t border-gray-100">
          <div>
            {priceText ? (
              <>
                <span className="text-lg font-bold text-gray-900">{t["price.from"]} {priceText}</span>
                <span className="text-sm text-gray-500">{t["price.perNight"]}</span>
                {isConverted && (
                  <span className="block text-[10px] text-gray-400" title="Conversion indicative, taux figés. Le paiement reste en devise de l'hébergement.">
                    {t["price.convertedNote"]} {sourceCurrency}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-gray-500">{t["price.unavailable"]}</span>
            )}
          </div>
          <span className="text-sm text-[#1B3A6B] font-medium group-hover:underline">
            {t["card.viewRooms"]}
          </span>
        </div>
      </div>
    </Link>
  );
}
