"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MapPin, Heart, Loader2, FolderInput, FolderPlus } from "lucide-react";
import { formatPrice, getPropertyTypeLabel, intlLocale } from "@/lib/utils";
import { countryLabel } from "@/lib/country-label";
import { Badge } from "@/components/ui/badge";
import type { PublicPropertyCard } from "@/lib/public-property";
import { convertAmount, formatMoney } from "@/lib/i18n";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { useWishlistToggle } from "@/lib/use-wishlist-toggle";
import { useT, useUiLocale } from "@/components/ui-locale-provider";
// T-154d (audit n°26, P2-8) : confirmation favori via ToastProvider.
import { useToast } from "@/components/ui/toast";
// T-246 (audit n°5, A1) : choix explicite de la liste de destination.
import { Dialog } from "@/components/ui/dialog";

interface PropertyCardProps {
  property: PublicPropertyCard;
  showFavorite?: boolean;
  /** Critères de séjour à préserver entre résultat de recherche et fiche. */
  searchQuery?: string;
  /** T-154c (audit n°26, P2-6) : carte affichée dans une liste de favoris —
   *  le cœur devient un retrait unitaire via DELETE ?wishlistId&propertyId. */
  removeFavoriteFrom?: { wishlistId: string };
  /** T-246 : autres listes de l'utilisateur, pour un déplacement en un clic. */
  moveTargets?: { id: string; name: string }[];
}

export function PropertyCardClient({ property, showFavorite = true, searchQuery, removeFavoriteFrom, moveTargets = [] }: PropertyCardProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const favorite = useWishlistToggle(property.id);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  /** T-246 : dialogue « Ajouter / déplacer vers une liste ». */
  const [listDialog, setListDialog] = useState<"add" | "move" | null>(null);
  const [moving, setMoving] = useState(false);
  const rating = property.averageRating ? parseFloat(property.averageRating) : null;

  // T-131/T-132 : préférences d'affichage (devise = XAF par défaut plateforme,
  // langue). L'aperçu des prix est converti dans la devise d'affichage ; les
  // paiements restent dans la devise de la chambre.
  const { currency: displayCurrency } = useDisplayPreferences();
  const locale = useUiLocale();
  const t = useT();
  const sourceCurrency = property.minCurrency ?? "EUR";
  const rawPrice = property.minPrice;
  const showPrice = rawPrice !== null && rawPrice !== undefined;
  const priceText = (() => {
    if (!showPrice) return null;
    const numeric = typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice);
    if (!displayCurrency || displayCurrency === sourceCurrency.toUpperCase()) {
      return formatPrice(numeric, sourceCurrency, locale);
    }
    // Taux figés V1 (i18n RATES_FROM_EUR) : indique une conversion approximative.
    return formatMoney(convertAmount(numeric, sourceCurrency, displayCurrency), displayCurrency, intlLocale(locale));
  })();
  const isConverted = showPrice && Boolean(displayCurrency) && displayCurrency !== sourceCurrency.toUpperCase();

  async function addToFavorites(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (favorite.busy) return;
    const wasSaved = favorite.saved;
    const outcome = await favorite.toggle();
    if (outcome === "unauthenticated") {
      window.location.href = "/connexion?next=%2Frecherche";
      return;
    }
    addToast(wasSaved ? "info" : "success", wasSaved ? t("headerActions.favoriteRemoved") : t("headerActions.favoriteAdded"));
  }

  async function removeFromFavorites(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!removeFavoriteFrom || removing) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(
        `/api/wishlists?wishlistId=${encodeURIComponent(removeFavoriteFrom.wishlistId)}&propertyId=${encodeURIComponent(property.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(t("fav.removeFail"));
      addToast("info", t("headerActions.favoriteRemoved"));
      router.refresh();
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : t("settings.error"));
      addToast("error", e instanceof Error ? e.message : t("fav.removeFail"));
    } finally {
      setRemoving(false);
    }
  }

  /** T-246 : déplacement transactionnel vers la liste choisie. */
  async function moveTo(targetWishlistId: string) {
    if (!removeFavoriteFrom) return;
    setMoving(true);
    setRemoveError(null);
    try {
      const res = await fetch("/api/wishlists/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          fromWishlistId: removeFavoriteFrom.wishlistId,
          toWishlistId: targetWishlistId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t("fav.moveFail"));
      }
      addToast("success", t("fav.moved"));
      setListDialog(null);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("settings.error");
      setRemoveError(message);
      addToast("error", message);
    } finally {
      setMoving(false);
    }
  }

  /** T-246 : ajout dans une liste choisie (cœur de la carte de recherche). */
  async function addToList(targetWishlistId: string) {
    const outcome = await favorite.addTo(targetWishlistId);
    if (outcome === "unauthenticated") {
      // `assign` plutôt qu'une affectation : la règle react-hooks/immutability
      // du dépôt interdit la mutation d'une valeur globale.
      window.location.assign("/connexion?next=%2Frecherche");
      return;
    }
    addToast("success", t("headerActions.favoriteAdded"));
    setListDialog(null);
  }

  return (
    <>
    <Link
      href={`/hebergement/${property.slug}${searchQuery ? `?${searchQuery}` : ""}`}
      className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          // T-186 : fallback local versionné (l'optimizer est actif — une
          // URL distante non auto-hébergée serait cassée sans egress).
          src={property.mainImage || "/seed-images/placeholder-property.jpg"}
          alt={property.name}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {removeFavoriteFrom ? (
          <>
            <button
              onClick={removeFromFavorites}
              aria-label={t("fav.remove")}
              title={removeError ?? (t("fav.remove"))}
              className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
            >
              {removing ? <Loader2 className="w-5 h-5 text-gray-600 animate-spin" /> : <Heart className="w-5 h-5 fill-[#FF5A5F] text-[#FF5A5F]" aria-hidden="true" />}
            </button>
            {moveTargets.length > 0 && (
              <button
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setListDialog("move");
                }}
                aria-label={t("fav.moveToList")}
                title={t("fav.moveToList")}
                className="absolute top-3 right-14 p-2 rounded-full bg-white/80 hover:bg-white text-gray-600 transition-colors"
              >
                <FolderInput className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </>
        ) : showFavorite ? (
          <button
            onClick={addToFavorites}
            aria-label={favorite.saved ? t("fav.added") : t("fav.add")}
            title={favorite.error ?? (favorite.saved ? t("fav.added") : t("fav.add"))}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
          >
            {favorite.busy ? <Loader2 className="w-5 h-5 text-gray-600 animate-spin" /> : <Heart className={`w-5 h-5 ${favorite.saved ? "fill-[#FF5A5F] text-[#FF5A5F]" : "text-gray-600"}`} aria-hidden="true" />}
          </button>
        ) : null}
        {!removeFavoriteFrom && showFavorite && favorite.lists.length > 1 && (
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setListDialog("add");
            }}
            aria-label={t("fav.chooseList")}
            title={t("fav.chooseList")}
            className="absolute top-12 right-3 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 transition-colors"
          >
            <FolderPlus className="w-4 h-4" aria-hidden="true" />
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
              {property.city}, {countryLabel(property.country, t)}
            </p>
          </div>
          {rating && (
            <div className="text-right shrink-0">
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#1B3A6B] text-white text-sm font-semibold rounded">
                {rating.toFixed(1)}
              </div>
              {property.totalReviews && property.totalReviews > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {property.totalReviews} {t("card.reviews")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
          <span className="px-2 py-0.5 bg-gray-100 rounded">
            {getPropertyTypeLabel(property.type, locale)}
          </span>
          {property.isEcoCertified && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
              {t("badge.eco")}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between pt-3 border-t border-gray-100">
          <div>
            {priceText ? (
              <>
                <span className="text-lg font-bold text-gray-900">{t("price.from")} {priceText}</span>
                <span className="text-sm text-gray-500">{t("price.perNight")}</span>
                {isConverted && (
                  <span className="block text-[10px] text-gray-400" title={t("bookingCard.conversionTooltip")}>
                    {t("price.convertedNote")} {sourceCurrency}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-gray-500">{t("price.unavailable")}</span>
            )}
          </div>
          <span className="text-sm text-[#1B3A6B] font-medium group-hover:underline">
            {t("card.viewRooms")}
          </span>
        </div>
      </div>
    </Link>

    {/* T-246 — dialogue monté hors du <Link> : un clic dans la boîte ne doit
        jamais ouvrir la fiche du logement. */}
    <Dialog
      open={listDialog !== null}
      onClose={() => (moving ? undefined : setListDialog(null))}
      title={listDialog === "move" ? t("fav.moveToList") : t("fav.chooseList")}
      description={listDialog === "move" ? t("fav.moveHint") : t("fav.chooseHint")}
      closeLabel={t("action.close")}
      footer={
        <button
          type="button"
          onClick={() => setListDialog(null)}
          disabled={moving}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {t("action.cancel")}
        </button>
      }
    >
      <ul className="space-y-1">
        {(listDialog === "move" ? moveTargets : favorite.lists).map((list) => (
          <li key={list.id}>
            <button
              type="button"
              disabled={moving}
              onClick={() => (listDialog === "move" ? moveTo(list.id) : addToList(list.id))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {list.name || t("fav.listUnnamed")}
            </button>
          </li>
        ))}
      </ul>
      {listDialog === "move" && (
        <p className="mt-3 text-xs text-gray-500">{t("fav.moveFrom")}</p>
      )}
      {removeError && listDialog !== null && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {removeError}
        </p>
      )}
    </Dialog>
    </>
  );
}
