/**
 * T-160 (audit n°30) — agrégation des favoris.
 *
 * « Mes favoris » (page + widget) doit compter un hébergement UNE fois
 * même s'il apparaît dans plusieurs listes de l'utilisateur (un bien peut
 * être partagé entre « Voyage » et « Week-end »). Fonctions pures,
 * testables, sans dépendance DB — le rendu de la page reste identique
 * pour les cas normaux (1 liste → 1 item → même compte).
 */

export type FavoriteProperty = { id: string } & Record<string, unknown>;

/**
 * Propriétés uniques par id, en conservant l'ordre de première apparition
 * (déterministe pour le rendu et les tests).
 */
export function uniqueProperties<T extends FavoriteProperty>(
  items: Array<T | null | undefined>,
): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!item || !item.id) continue;
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

/**
 * Nombre d'hébergements distincts sur l'ensemble des listes (évite de
 * compter 2× un bien présent dans plusieurs listes).
 */
export function countUniqueProperties<T extends FavoriteProperty>(
  items: Array<T | null | undefined>,
): number {
  return uniqueProperties(items).length;
}

/**
 * Regroupe des lignes `wishlist_items ⋈ properties` par liste, avec le
 * compteur d'items réel de la liste (itemCount) ET les propriétés uniques
 * de l'utilisateur. Utilisé par la page pour remplacer le N+1.
 */
export interface WishlistAggregated<TProperty> {
  id: string;
  items: TProperty[];
  itemCount: number;
}

export function aggregateWishlistItems<TProperty extends FavoriteProperty>(
  wishlistIds: string[],
  rows: Array<{ wishlistId: string; property: TProperty | null }>,
): Map<string, WishlistAggregated<TProperty>> {
  const map = new Map<string, WishlistAggregated<TProperty>>();
  for (const id of wishlistIds) map.set(id, { id, items: [], itemCount: 0 });
  for (const row of rows) {
    const bucket = map.get(row.wishlistId);
    if (!bucket) continue;
    bucket.itemCount += 1; // items réellement en base dans cette liste
    if (row.property) bucket.items.push(row.property);
  }
  return map;
}
