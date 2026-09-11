import type { db as Database } from "@/db";
import { properties, rooms, users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * T-265 (audit n°7, C1) — re-vérification de disponibilité à la confirmation.
 *
 * Constat d'audit (rejoué à l'exécution) : la transition `pending → confirmed`
 * n'était validée que par `transitionError()` (statut, acteur, date) — une
 * demande créée sur un bien `active` pouvait être confirmée **après** la
 * suspension de l'annonce (ou de l'hôte, ou la désactivation de la chambre) :
 * le voyageur finissait avec un séjour confirmé sur une fiche publique en 404.
 *
 * La garde reprend **à l'identique** les prédicats de `POST /api/bookings`
 * (T-233) : bien `active`, hôte ni suspendu ni supprimé, chambre `isActive`.
 * Elle est appelée **sous le lock** de la transaction de confirmation : pas de
 * fenêtre de course entre la vérification et le commit.
 *
 * @returns le message d'erreur FR (source, mappé EN par `apiError`) ou `null`
 *   si le bien et la chambre restent disponibles.
 */
export async function confirmBookingAvailabilityError(
  tx: Parameters<Parameters<typeof Database.transaction>[0]>[0] | typeof Database,
  booking: { propertyId: string; roomId: string },
): Promise<string | null> {
  const [listing] = await tx
    .select({
      propertyStatus: properties.status,
      hostSuspendedAt: users.suspendedAt,
      hostDeletedAt: users.deletedAt,
    })
    .from(properties)
    .leftJoin(users, eq(properties.hostId, users.id))
    .where(eq(properties.id, booking.propertyId))
    .limit(1);

  if (!listing || listing.propertyStatus !== "active" || listing.hostSuspendedAt || listing.hostDeletedAt) {
    return "Hébergement non disponible";
  }

  const [room] = await tx
    .select({ active: rooms.isActive })
    .from(rooms)
    .where(eq(rooms.id, booking.roomId))
    .limit(1);

  if (!room || !room.active) return "Chambre non disponible";
  return null;
}
