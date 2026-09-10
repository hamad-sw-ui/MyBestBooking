import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { rooms, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";

/**
 * T-217 (P6/BUG-053) — `/dashboard/rooms/<id>` renvoyait un 404 : la seule
 * surface d'édition d'une unité (`RoomEditSection`, calendrier prix/stock,
 * rate-plans) vit sous `/dashboard/rooms/<id>/calendrier`, et rien ne
 * permettait de deviner ce suffixe. Les fiches de chambre profondément liées
 * (favoris, historique, documentation) aboutissaient donc à une impasse.
 *
 * Cette page est désormais une **redirection serveur** vers la surface
 * d'édition réelle, avec les mêmes contrôles d'accès que celle-ci (hôte
 * propriétaire ou admin ; identifiant mal formé → 404). Aucun écran n'est
 * dupliqué ni modifié : le lien profond fonctionne, l'URL canonique reste
 * `/dashboard/rooms/<id>/calendrier`.
 */
export const dynamic = "force-dynamic";

export default async function RoomDetailsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.role !== "host" && user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [row] = await db
    .select({ roomId: rooms.id, hostId: properties.hostId })
    .from(rooms)
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(eq(rooms.id, id))
    .limit(1);
  if (!row) notFound();
  if (row.hostId !== user.id && user.role !== "admin") {
    redirect("/dashboard/rooms");
  }

  redirect(`/dashboard/rooms/${id}/calendrier`);
}
