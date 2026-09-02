/**
 * T-177 — disponibilité restante d'une chambre sur la fiche hébergement.
 *
 * Avant : la fiche affichait le bouton « Réserver » même sur des périodes
 * épuisées (attente inévitable d'un 409 au checkout). La brique calcule,
 * côté serveur et sans régression (aucun changement quand les dates ne
 * sont pas fournies), l'inventaire restant avec la MÊME règle que
 * POST /api/bookings (T-157) : une réservation non annulée (`pending`
 * incluse) chevauchant le séjour consomme une unité de `quantity`.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Inventaire physique d'une chambre avec le défaut défensif du moteur. */
export function roomPhysicalInventory(quantity: number | null | undefined): number {
  return Number.isInteger(quantity) && (quantity as number) > 0 ? (quantity as number) : 1;
}

/** Unités restantes = inventaire physique − réservations chevauchantes (≥ 0). */
export function remainingRoomInventory(
  quantity: number | null | undefined,
  overlappingBookings: number,
): number {
  const used = Number.isInteger(overlappingBookings) && overlappingBookings > 0 ? overlappingBookings : 0;
  return Math.max(0, roomPhysicalInventory(quantity) - used);
}

/**
 * Séjour issu de la query fiche (`?checkIn=…&checkOut=…`) — null si absent,
 * mal formé ou incohérent (départ ≤ arrivée) : dans ces cas la fiche ne
 * calcule AUCUNE disponibilité et affiche les CTA comme avant.
 */
export function stayDatesFromPropertyQuery(
  checkIn: string | undefined | null,
  checkOut: string | undefined | null,
): { checkIn: string; checkOut: string } | null {
  if (!checkIn || !checkOut) return null;
  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut)) return null;
  if (checkOut <= checkIn) return null;
  return { checkIn, checkOut };
}
