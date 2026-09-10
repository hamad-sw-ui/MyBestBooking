import type { UiStringKey } from "@/lib/ui-strings";

/**
 * Source unique des types d'hébergement exposés par l'API et les formulaires.
 *
 * La liste correspond au contrat historique des routes properties ; les helpers
 * évitent que la recherche oublie des types pourtant créables côté dashboard.
 */
export const PROPERTY_TYPE_VALUES = [
  "hotel",
  "apartment",
  "house",
  "villa",
  "hostel",
  "resort",
  "bnb",
  "guesthouse",
  "riad",
  "camping",
] as const;

export type PropertyType = (typeof PROPERTY_TYPE_VALUES)[number];

const PROPERTY_TYPE_LABELS_FR: Record<PropertyType, string> = {
  hotel: "Hôtel",
  apartment: "Appartement",
  house: "Maison",
  villa: "Villa",
  hostel: "Auberge",
  resort: "Resort",
  bnb: "B&B",
  guesthouse: "Maison d'hôtes",
  riad: "Riad",
  camping: "Camping",
};

const PROPERTY_TYPE_LABELS_EN: Record<PropertyType, string> = {
  hotel: "Hotel",
  apartment: "Apartment",
  house: "House",
  villa: "Villa",
  hostel: "Hostel",
  resort: "Resort",
  bnb: "B&B",
  guesthouse: "Guesthouse",
  riad: "Riad",
  camping: "Camping",
};

export const PROPERTY_TYPE_LABEL_KEYS: Record<PropertyType, UiStringKey> = {
  hotel: "search.type.hotel",
  apartment: "search.type.apartment",
  house: "prop.type.house",
  villa: "search.type.villa",
  hostel: "search.type.hostel",
  resort: "search.type.resort",
  bnb: "prop.type.bnb",
  guesthouse: "search.type.guesthouse",
  riad: "search.type.riad",
  camping: "prop.type.camping",
};

export function isPropertyType(value: string | null | undefined): value is PropertyType {
  return PROPERTY_TYPE_VALUES.includes(value as PropertyType);
}

export function propertyTypeLabel(type: string, locale: string = "fr"): string {
  if (!isPropertyType(type)) return type;
  const labels = locale === "en" || locale.startsWith("en") ? PROPERTY_TYPE_LABELS_EN : PROPERTY_TYPE_LABELS_FR;
  return labels[type];
}

export function propertyTypeOptions(t: (key: UiStringKey) => string): Array<{ value: PropertyType; label: string }> {
  return PROPERTY_TYPE_VALUES.map((value) => ({ value, label: t(PROPERTY_TYPE_LABEL_KEYS[value]) }));
}
