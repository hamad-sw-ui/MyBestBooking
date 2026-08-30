import type { Property } from "@/db/schema";
import { toPublicPropertyCard, type PublicPropertyCard } from "@/lib/public-property";
import { PropertyCardClient } from "./property-card-client";

interface PropertyCardProps {
  /** La wrapper Server Component assainit tout modèle Drizzle avant Flight. */
  property: Property | PublicPropertyCard;
  showFavorite?: boolean;
  searchQuery?: string;
}

function isPublicCard(property: Property | PublicPropertyCard): property is PublicPropertyCard {
  return !("hostId" in property) && !("commissionRate" in property);
}

/**
 * Frontière serveur obligatoire pour les cartes publiques : même si un caller
 * DB transmet une Property complète, seules les clés allowlistées atteignent
 * le composant client et le payload RSC du navigateur.
 */
export function PropertyCard({ property, showFavorite, searchQuery }: PropertyCardProps) {
  const safe = isPublicCard(property) ? property : toPublicPropertyCard(property, {
    minPrice: (property as Property & { minPrice?: number | null }).minPrice,
    minCurrency: (property as Property & { minCurrency?: string | null }).minCurrency,
  });
  return <PropertyCardClient property={safe} showFavorite={showFavorite} searchQuery={searchQuery} />;
}
