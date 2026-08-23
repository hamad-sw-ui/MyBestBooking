import type { Property } from "@/db/schema";

/**
 * Contrat explicite des données pouvant traverser une frontière publique/RSC.
 * Ne jamais sérialiser `Property` Drizzle directement vers un Client Component:
 * il contient hostId, commissionRate et identifiants de validation internes.
 */
export type PublicProperty = Pick<Property,
  | "id"
  | "name"
  | "slug"
  | "type"
  | "description"
  | "descriptionEn"
  | "starRating"
  | "addressLine"
  | "city"
  | "state"
  | "country"
  | "postalCode"
  | "latitude"
  | "longitude"
  | "timezone"
  | "checkInFrom"
  | "checkInUntil"
  | "checkOutUntil"
  | "cancellationPolicy"
  | "petsAllowed"
  | "smokingAllowed"
  | "isBestrewards"
  | "isPreferred"
  | "isEcoCertified"
  | "averageRating"
  | "totalReviews"
  | "amenities"
  | "images"
  | "mainImage"
>;

export type PublicPropertyCard = Pick<PublicProperty,
  | "id"
  | "name"
  | "slug"
  | "type"
  | "city"
  | "country"
  | "starRating"
  | "averageRating"
  | "totalReviews"
  | "isBestrewards"
  | "isEcoCertified"
  | "mainImage"
> & {
  minPrice?: number | null;
  minCurrency?: string | null;
};

export function toPublicProperty(property: Property): PublicProperty {
  return {
    id: property.id,
    name: property.name,
    slug: property.slug,
    type: property.type,
    description: property.description,
    descriptionEn: property.descriptionEn,
    starRating: property.starRating,
    addressLine: property.addressLine,
    city: property.city,
    state: property.state,
    country: property.country,
    postalCode: property.postalCode,
    latitude: property.latitude,
    longitude: property.longitude,
    timezone: property.timezone,
    checkInFrom: property.checkInFrom,
    checkInUntil: property.checkInUntil,
    checkOutUntil: property.checkOutUntil,
    cancellationPolicy: property.cancellationPolicy,
    petsAllowed: property.petsAllowed,
    smokingAllowed: property.smokingAllowed,
    isBestrewards: property.isBestrewards,
    isPreferred: property.isPreferred,
    isEcoCertified: property.isEcoCertified,
    averageRating: property.averageRating,
    totalReviews: property.totalReviews,
    amenities: property.amenities,
    images: property.images,
    mainImage: property.mainImage,
  };
}

export function toPublicPropertyCard(
  property: Property,
  pricing?: { minPrice?: number | null; minCurrency?: string | null },
): PublicPropertyCard {
  return {
    id: property.id,
    name: property.name,
    slug: property.slug,
    type: property.type,
    city: property.city,
    country: property.country,
    starRating: property.starRating,
    averageRating: property.averageRating,
    totalReviews: property.totalReviews,
    isBestrewards: property.isBestrewards,
    isEcoCertified: property.isEcoCertified,
    mainImage: property.mainImage,
    minPrice: pricing?.minPrice,
    minCurrency: pricing?.minCurrency,
  };
}
