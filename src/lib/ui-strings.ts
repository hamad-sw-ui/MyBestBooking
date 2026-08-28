/**
 * T-132 — Libellés d'interface localisés (FR par défaut, EN).
 *
 * L'arabe (ar) reste hors périmètre V1 (pas de dictionnaire RTL) : on
 * retombe sur le français. Ce module ne couvre volontairement que les
 * libellés d'affichage des composants publics — pas l'intégralité de
 * l'application (chantier i18n plus large documenté dans l'audit n°11).
 */

export type UiLocale = "fr" | "en";

const FR = {
  "price.from": "Dès",
  "price.perNight": "/nuit",
  "price.unavailable": "Prix indisponible",
  "price.fromShort": "À partir de",
  "price.perNightLong": "par nuit",
  "price.convertedNote": "Conversion indicative · paiement en",
  "book.seeAvailability": "Voir les disponibilités",
  "book.noRoom": "Aucune chambre disponible",
  "book.checkIn": "Arrivée",
  "book.checkOut": "Départ",
  "book.adults": "Adultes",
  "book.children": "Enfants",
  "book.cancelShown": "✓ Conditions d'annulation affichées avant confirmation",
  "fav.add": "Ajouter aux favoris",
  "fav.added": "Ajouté aux favoris",
  "card.reviews": "avis",
  "card.viewRooms": "Voir les chambres →",
} as const;

export type UiStringKey = keyof typeof FR;

const EN: Record<UiStringKey, string> = {
  "price.from": "From",
  "price.perNight": "/night",
  "price.unavailable": "Price unavailable",
  "price.fromShort": "From",
  "price.perNightLong": "per night",
  "price.convertedNote": "Indicative conversion · charged in",
  "book.seeAvailability": "See availability",
  "book.noRoom": "No room available",
  "book.checkIn": "Check-in",
  "book.checkOut": "Check-out",
  "book.adults": "Adults",
  "book.children": "Children",
  "book.cancelShown": "✓ Cancellation policy shown before confirmation",
  "fav.add": "Add to favorites",
  "fav.added": "Added to favorites",
  "card.reviews": "reviews",
  "card.viewRooms": "View rooms →",
};

export function isUiLocale(locale: string | null | undefined): locale is UiLocale {
  return locale === "fr" || locale === "en";
}

export function uiStrings(locale: string | null | undefined): Record<UiStringKey, string> {
  const loc = isUiLocale(locale) ? locale : "fr";
  return loc === "en" ? EN : FR;
}
