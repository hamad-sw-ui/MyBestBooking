import type { db as Database } from "@/db";
import { properties } from "@/db/schema";
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";

/**
 * T-233 (audit n°3, F2) — la suspension d'un hôte a un effet réel sur ses annonces.
 *
 * Constat d'audit : après `PATCH /api/users/[id]/suspend`, l'hôte ne pouvait plus
 * se connecter (401) **mais** sa fiche `/hebergement/appartement-montmartre`
 * répondait toujours 200 et le bien restait dans `/recherche?city=Paris`. La
 * sanction était cosmétique côté compte et inexistante côté catalogue : un
 * voyageur pouvait réserver auprès d'un hôte suspendu.
 *
 * Deux mécanismes complémentaires, volontairement redondants :
 *
 *  1. **Cascade** : la suspension passe ses annonces publiées de `active` à
 *     `suspended`, en mémorisant celles qui étaient actives. La réactivation
 *     restaure **exactement** cet ensemble — une annonce restée en brouillon
 *     avant la sanction n'est jamais publiée par erreur.
 *  2. **Filtre d'hôte actif** : les surfaces publiques (recherche, fiche,
 *     création de réservation) exigent `users.suspended_at IS NULL`. Même si une
 *     annonce était publiée par un autre chemin, elle reste invisible. C'est le
 *     filet de sécurité : la cascade se répare, le filtre protège.
 *
 * Les statuts antérieurs sont conservés dans `audit_log` (traçabilité) et l'état
 * de publication restauré est celui du moment : l'opération est idempotente.
 */

type Tx = Parameters<Parameters<typeof Database.transaction>[0]>[0] | typeof Database;

/**
 * Table `users` utilisée comme source de la condition d'hôte actif.
 * Les requêtes publiques écrivent `.innerJoin(users, eq(properties.hostId, users.id))`
 * puis poussent `activeHostCondition(ACTIVE_HOST_ALIAS)`.
 */
export { users as ACTIVE_HOST_ALIAS } from "@/db/schema";

/**
 * Suspend les annonces publiées d'un hôte et retourne les identifiants touchés.
 * À appeler **dans** la transaction de la suspension.
 */
export async function suspendHostListings(tx: Tx, hostId: string): Promise<string[]> {
  const published = await tx
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.hostId, hostId), eq(properties.status, "active")));

  const ids = published.map((row) => row.id);
  if (ids.length === 0) return [];

  await tx
    .update(properties)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(inArray(properties.id, ids));

  return ids;
}

/**
 * Restaure les annonces suspendues d'un hôte réactivé.
 *
 * Seules les annonces **encore** en `suspended` sont republiées : une annonce
 * supprimée ou archivée entre-temps par l'admin n'est pas ressuscitée.
 */
export async function reactivateHostListings(tx: Tx, hostId: string): Promise<string[]> {
  const suspended = await tx
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.hostId, hostId), eq(properties.status, "suspended")));

  const ids = suspended.map((row) => row.id);
  if (ids.length === 0) return [];

  await tx
    .update(properties)
    .set({ status: "active", updatedAt: new Date() })
    .where(inArray(properties.id, ids));

  return ids;
}

/**
 * Condition SQL « cet hébergement appartient à un hôte actif ».
 *
 * Utilisée par les requêtes publiques **en complément** de `status = 'active'` :
 * une annonce publiée par un hôte suspendu ou supprimé ne doit apparaître ni
 * dans la recherche, ni sur sa fiche, ni dans le tunnel de réservation.
 *
 * À appliquer sur l'alias de `users` joint à la requête :
 *   `.innerJoin(hostUsers, eq(properties.hostId, hostUsers.id))`
 *   `.where(and(..., activeHostCondition(hostUsers)))`
 */
export function activeHostCondition(hostUser: { suspendedAt: unknown; deletedAt: unknown }): SQL {
  // `isNull` des deux colonnes administrées par la plateforme :
  // - `suspended_at` : sanction réversible ;
  // - `deleted_at`  : compte supprimé (anonymisé), définitif.
  // Retour typé `SQL` (jamais `undefined`) : l'appelant peut le pousser
  // directement dans une liste de conditions `and(...)`.
  return and(
    isNull(hostUser.suspendedAt as never),
    isNull(hostUser.deletedAt as never),
  ) as SQL;
}
