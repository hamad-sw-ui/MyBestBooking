// T-129 (audit n°9 P2/P3) : cohérence des capacités et bornage du prix d'une
// chambre. Ces règles métier complètent la validation de forme (Zod) : elles
// empêchent de stocker une chambre incohérente (ex. plus d'adultes que la
// capacité maximale) ou un tarif nul. Les réservations restent par ailleurs
// protégées par booking-rules (rejet en 409 si la capacité est dépassée).

export type RoomCapacityInput = {
  maxOccupancy: number;
  maxAdults: number;
  maxChildren?: number | null;
  basePrice: number;
  quantity?: number | null;
};

export const ROOM_MAX_QUANTITY = 99;

/**
 * Vérifie la cohérence des capacités et du tarif. Renvoie un message d'erreur
 * explicite en français, ou `null` si l'ensemble est valide.
 * Utilisé à la création (valeurs complètes) et à l'édition (valeurs fusionnées
 * avec l'existant) pour garantir la même règle dans les deux chemins.
 */
export function validateRoomCapacity(input: RoomCapacityInput): string | null {
  const { maxOccupancy, maxAdults, maxChildren = 0, basePrice, quantity } = input;

  if (maxAdults > maxOccupancy) {
    return "Le nombre d'adultes ne peut pas dépasser la capacité maximale";
  }
  if (maxAdults + (maxChildren ?? 0) > maxOccupancy) {
    return "Adultes + enfants ne peuvent pas dépasser la capacité maximale";
  }
  if (!(basePrice > 0)) {
    return "Le prix de base doit être strictement positif";
  }
  if (quantity != null && quantity > ROOM_MAX_QUANTITY) {
    return `La quantité ne peut pas dépasser ${ROOM_MAX_QUANTITY}`;
  }
  return null;
}
