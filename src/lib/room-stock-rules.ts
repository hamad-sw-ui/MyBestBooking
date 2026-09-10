/**
 * T-244 (audit n°4, constat N3) — règle de stock vendable, **pure**.
 *
 * Ce module ne doit dépendre d'aucun accès base ni d'aucun module Node : il est
 * consommé par le calendrier hôte (`"use client"`). La lecture des séjours en
 * base vit dans `src/lib/room-stock.ts` (serveur uniquement) — la séparation
 * évite d'embarquer `pg` dans le bundle navigateur.
 */

/** Reste vendable d'un jour : stock déclaré borné par la capacité, moins les séjours. */
export function remainingStock(declared: number, capacity: number, booked: number): number {
  const cap = Math.min(Math.max(0, declared), Math.max(0, capacity));
  return Math.max(0, cap - Math.max(0, booked));
}
