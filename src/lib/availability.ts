/**
 * Utilitaires de vérification de disponibilité de chambres (T-012).
 *
 * Convention hôtelière standard : le check-out d'un séjour peut
 * coïncider avec le check-in d'un séjour suivant sur la même chambre.
 * On considère donc deux intervalles [checkIn, checkOut) (semi-ouverts).
 */

export interface DateRange {
  checkIn: string; // 'YYYY-MM-DD'
  checkOut: string;
}

/**
 * Deux intervalles [aIn, aOut) et [bIn, bOut) se chevauchent
 * ssi aIn < bOut ET aOut > bIn.
 * Adjacent (aOut === bIn) → PAS de chevauchement.
 */
export function hasOverlap(a: DateRange, b: DateRange): boolean {
  return a.checkIn < b.checkOut && a.checkOut > b.checkIn;
}
