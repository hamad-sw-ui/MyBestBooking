import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { properties, rooms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import PropertyEditClient from "./property-edit-client";

/**
 * T-217 (BUG-052) — l'édition d'un hébergement était un **composant client**
 * (`useParams` + `fetch('/api/properties/:id')`) : aucune donnée au premier
 * rendu, `notFound()` impossible, et un identifiant malformé ou absent
 * affichait l'écran d'erreur applicatif (statut HTTP 200).
 *
 * La page est désormais rendue côté serveur : elle valide l'identifiant,
 * charge l'hébergement et ses chambres, applique la règle d'accès (hôte
 * propriétaire ou admin) puis passe les données initiales au formulaire
 * client — qui conserve ses `PUT`/upload inchangés.
 */
export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.role !== "host" && user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  // BUG-048 : identifiant mal formé → 404 propre (pas d'erreur Postgres 22P02).
  if (!isUuid(id)) notFound();

  const [row] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);
  if (!row) notFound();
  if (user.role !== "admin" && row.hostId !== user.id) {
    redirect("/dashboard/properties");
  }

  const roomRows = await db
    .select()
    .from(rooms)
    .where(eq(rooms.propertyId, id))
    .orderBy(asc(rooms.createdAt));

  return (
    <PropertyEditClient
      propertyId={row.id}
      isAdmin={user.role === "admin"}
      initialProperty={{
        id: row.id,
        name: row.name,
        slug: row.slug,
        type: row.type,
        description: row.description,
        starRating: row.starRating,
        addressLine: row.addressLine,
        city: row.city,
        postalCode: row.postalCode,
        country: row.country,
        cancellationPolicy: row.cancellationPolicy,
        petsAllowed: row.petsAllowed,
        smokingAllowed: row.smokingAllowed,
        // T-227 (A7) : horaires + fuseau de l'hébergement (jusqu'ici affichés
        // sur la fiche publique avec des replis codés en dur, non éditables).
        checkInFrom: row.checkInFrom,
        checkInUntil: row.checkInUntil,
        checkOutUntil: row.checkOutUntil,
        timezone: row.timezone,
        // T-228 (A8) : labels/badges (admin uniquement côté API).
        isEcoCertified: row.isEcoCertified,
        isBestrewards: row.isBestrewards,
        isPreferred: row.isPreferred,
        amenities: Array.isArray(row.amenities) ? (row.amenities as string[]) : [],
        mainImage: row.mainImage,
        images: Array.isArray(row.images) ? (row.images as string[]) : [],
        status: row.status,
        averageRating: row.averageRating,
        totalReviews: row.totalReviews,
        commissionRate: row.commissionRate,
      }}
      initialRooms={roomRows.map((room) => ({
        id: room.id,
        name: room.name,
        roomType: room.roomType,
        maxOccupancy: room.maxOccupancy,
        basePrice: String(room.basePrice),
        currency: room.currency ?? "EUR",
        quantity: room.quantity,
        isActive: room.isActive ?? true,
      }))}
    />
  );
}
