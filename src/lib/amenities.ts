/**
 * Source unique des équipements (audit n°26, P3-13).
 *
 * Avant : 3 listes divergentes (recherche 5 valeurs, formulaire hôte 12,
 * fiche publique 6 libellés) alors que la base/seed contient 28 valeurs.
 * Ici : liste complète id + libellés fr/en, consommée par le formulaire
 * hôte (new/edit), la recherche et la fiche publique. Additif, les ids
 * en base sont inchangés (aucune migration).
 */

export interface AmenityDef {
  id: string;
  label: string;
  labelEn: string;
}

export const AMENITIES: AmenityDef[] = [
  { id: "wifi", label: "WiFi gratuit", labelEn: "Free Wi-Fi" },
  { id: "parking", label: "Parking", labelEn: "Parking" },
  { id: "pool", label: "Piscine", labelEn: "Swimming pool" },
  { id: "spa", label: "Spa", labelEn: "Spa" },
  { id: "restaurant", label: "Restaurant", labelEn: "Restaurant" },
  { id: "bar", label: "Bar", labelEn: "Bar" },
  { id: "gym", label: "Salle de sport", labelEn: "Fitness room" },
  { id: "air_conditioning", label: "Climatisation", labelEn: "Air conditioning" },
  { id: "room_service", label: "Room service", labelEn: "Room service" },
  { id: "concierge", label: "Conciergerie", labelEn: "Concierge" },
  { id: "beach_access", label: "Accès plage", labelEn: "Beach access" },
  { id: "garden", label: "Jardin", labelEn: "Garden" },
  { id: "balcony", label: "Balcon", labelEn: "Balcony" },
  { id: "bbq", label: "Barbecue", labelEn: "BBQ" },
  { id: "beach", label: "Plage", labelEn: "Beach" },
  { id: "breakfast", label: "Petit-déjeuner", labelEn: "Breakfast" },
  { id: "city_view", label: "Vue sur la ville", labelEn: "City view" },
  { id: "countryside_view", label: "Vue sur la campagne", labelEn: "Countryside view" },
  { id: "kids_club", label: "Club enfants", labelEn: "Kids club" },
  { id: "kitchen", label: "Cuisine", labelEn: "Kitchen" },
  { id: "rooftop", label: "Rooftop", labelEn: "Rooftop" },
  { id: "sea_view", label: "Vue sur la mer", labelEn: "Sea view" },
  { id: "terrace", label: "Terrasse", labelEn: "Terrace" },
  { id: "traditional_hammam", label: "Hammam traditionnel", labelEn: "Traditional hammam" },
  { id: "washing_machine", label: "Machine à laver", labelEn: "Washing machine" },
  { id: "water_sports", label: "Sports nautiques", labelEn: "Water sports" },
  { id: "tv", label: "TV", labelEn: "TV" },
  { id: "minibar", label: "Minibar", labelEn: "Minibar" },
];

/** Libellé d'un équipement selon la langue (fr par défaut). */
export function amenityLabel(id: string, lang: "fr" | "en" = "fr"): string {
  const def = AMENITIES.find((a) => a.id === id);
  if (!def) return id;
  return lang === "en" ? def.labelEn : def.label;
}
