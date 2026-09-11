import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties, ratePlans, rooms, reviews, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, zodErrorResponse } from "@/lib/http";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { toPublicProperty } from "@/lib/public-property";
import { apiError } from "@/lib/api-error";
// T-154d (audit n°26, P2-4) : taux de TVA et réduction BestRewards réels
// (settings, niveau du user courant) exposés en lecture seule à l'aperçu de
// réservation — plus de TVA 0.1 en dur ni de remise invisible côté client.
import { getSetting } from "@/lib/settings";
import { PROPERTY_TYPE_VALUES } from "@/lib/property-types";
import { requireApprovedHost } from "@/lib/host-approval";
import { isValidTimezone } from "@/lib/timezone";
import { coordinateField } from "@/lib/coordinates";
import { assertNotMaintenance, MaintenanceError, maintenanceResponse } from "@/lib/maintenance";

const updatePropertySchema = z.object({
  name: z.string().min(3).optional(),
  type: z.enum(PROPERTY_TYPE_VALUES).optional(),
  description: z.string().optional(),
  // T-259 (audit n°6, B6) : description EN, région et coordonnées — colonnes
  // existantes, affichées en public, jusqu'ici inaccessibles depuis l'UI.
  descriptionEn: z.string().max(4000, "La description (EN) ne peut pas dépasser 4 000 caractères").optional(),
  starRating: z.number().min(0).max(5).optional(),
  addressLine: z.string().optional(),
  city: z.string().min(2).optional(),
  state: z.string().max(100, "La région ne peut pas dépasser 100 caractères").optional(),
  country: z.string().length(2).optional(),
  postalCode: z.string().optional(),
  latitude: coordinateField("latitude"),
  longitude: coordinateField("longitude"),
  cancellationPolicy: z.enum(["free", "flexible", "moderate", "strict", "non_refundable"]).optional(),
  petsAllowed: z.boolean().optional(),
  smokingAllowed: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  mainImage: z.string().optional(),
  status: z.enum(["draft", "pending", "active", "suspended", "archived"]).optional(),
  // T-021 audit follow-up : commission par property, admin uniquement
  // (filtré côté handler ci-dessous).
  commissionRate: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Commission invalide").optional(),
  // T-227 (A7) : horaires d'arrivée/départ et fuseau de l'hébergement.
  checkInFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure d'arrivée (début) invalide (HH:MM)").optional(),
  checkInUntil: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure d'arrivée (fin) invalide (HH:MM)").optional(),
  checkOutUntil: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure de départ invalide (HH:MM)").optional(),
  timezone: z
    .string()
    .max(50)
    .refine((value) => isValidTimezone(value), "Fuseau horaire inconnu")
    .optional(),
  // T-228 (A8) : labels/badges = décision éditoriale de la plateforme.
  // Réservés à l'admin (même frontière que `commissionRate`/`status`).
  isEcoCertified: z.boolean().optional(),
  isBestrewards: z.boolean().optional(),
  isPreferred: z.boolean().optional(),
});
// T-227 (A7) : la fenêtre d'arrivée ne peut pas être vide (début = fin). Une
// fenêtre à cheval sur minuit (18:00 → 02:00) reste acceptée : c'est une
// pratique hôtelière courante, là où `14:00 → 14:00` n'a aucun sens.
function checkInWindowError(from: string | undefined, until: string | undefined): string | null {
  if (from && until && from === until) {
    return "La fenêtre d'arrivée est vide : le début et la fin doivent différer";
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    }
    const user = await getCurrentUser();
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id));

    if (!property) {
      return NextResponse.json({ error: await apiError("Hébergement non trouvé") }, { status: 404 });
    }

    const canSeePrivate = user?.role === "admin" || property.hostId === user?.id;
    // 404 plutôt que 403 : une URL publique ne doit pas confirmer qu’un
    // brouillon, un suspendu ou un archive existe.
    if (property.status !== "active" && !canSeePrivate) {
      return NextResponse.json({ error: await apiError("Hébergement non trouvé") }, { status: 404 });
    }

    const propertyRooms = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.propertyId, id), ...(canSeePrivate ? [] : [eq(rooms.isActive, true)])));

    const roomIds = propertyRooms.map((room) => room.id);
    const propertyRatePlans = roomIds.length
      ? await db.select().from(ratePlans).where(and(
        ...(canSeePrivate ? [] : [eq(ratePlans.isActive, true)]),
        sql`${ratePlans.roomId} IN (${sql.join(roomIds.map((roomId) => sql`${roomId}`), sql`, `)})`,
      ))
      : [];

    const propertyReviews = await db
      .select({
        review: reviews,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          country: users.country,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(and(eq(reviews.propertyId, id), eq(reviews.status, "approved")))
      .orderBy(desc(reviews.createdAt))
      .limit(10);

    const [host] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, property.hostId));

    // T-154d (audit n°26, P2-4) : champs read-only ajoutés pour que l'aperçu
    // de réservation affiche la TVA configurée et la remise BestRewards
    // réelle (mêmes règles que POST /api/bookings). Additif : rien d'existant
    // n'est modifié ; anon/invité → bestrewardsDiscountPercent null.
    const [billing, bestrewardsSettings] = await Promise.all([
      getSetting("billing"),
      getSetting("bestrewards"),
    ]);
    let bestrewardsDiscountPercent: number | null = null;
    if (user) {
      const [viewer] = await db
        .select({ level: users.bestrewardsLevel })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      const level = viewer?.level ?? 1;
      let pct = level >= 3
        ? bestrewardsSettings.discounts[2]
        : level >= 2
          ? bestrewardsSettings.discounts[1]
          : bestrewardsSettings.discounts[0];
      if (property.isBestrewards && level >= 2) pct = Math.min(30, pct + 2);
      bestrewardsDiscountPercent = pct > 0 ? pct : null;
    }
    const baseProperty = canSeePrivate ? property : toPublicProperty(property);

    return NextResponse.json({
      property: {
        ...baseProperty,
        taxRate: billing.taxRate ?? 0.1,
        bestrewardsDiscountPercent,
      },
      rooms: propertyRooms,
      ratePlans: propertyRatePlans,
      reviews: propertyReviews,
      host,
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 401 }
      );
    }
    await assertNotMaintenance(user);

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    }
    const body = await request.json();
    const data = updatePropertySchema.parse(body);

    // Check ownership or admin
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id));

    if (!property) {
      return NextResponse.json(
        { error: await apiError("Hébergement non trouvé") },
        { status: 404 }
      );
    }

    if (property.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 403 }
      );
    }

    // T-021 audit follow-up : commissionRate est un champ admin-only.
    // Un host ne peut jamais modifier sa propre commission.
    if (data.commissionRate !== undefined && user.role !== "admin") {
      return NextResponse.json(
        { error: await apiError("Modification de commission réservée à l'admin") },
        { status: 403 },
      );
    }
    // T-228 (A8) : `isEcoCertified` (badge « Éco ») n'était écrit par aucun
    // code — le badge était inatteignable — et `isBestrewards`/`isPreferred`
    // n'étaient posés que par le seed aléatoire, alors qu'`isBestrewards`
    // majore la remise BestRewards. Ces labels sont une décision éditoriale :
    // un hôte ne peut pas se les attribuer lui-même.
    // T-227 (A7) : le PUT est partiel → on valide l'état **résultant** de la
    // fusion (sinon une mise à jour partielle pourrait produire une fenêtre
    // d'arrivée incohérente avec l'existant).
    const windowError = checkInWindowError(
      data.checkInFrom ?? property.checkInFrom?.slice(0, 5),
      data.checkInUntil ?? property.checkInUntil?.slice(0, 5),
    );
    if (windowError) {
      return NextResponse.json({ error: await apiError(windowError) }, { status: 400 });
    }

    const LABEL_FIELDS = ["isEcoCertified", "isBestrewards", "isPreferred"] as const;
    const attemptedLabel = LABEL_FIELDS.find((field) => data[field] !== undefined);
    if (attemptedLabel && user.role !== "admin") {
      return NextResponse.json(
        { error: await apiError("Modification des labels réservée à l'administration") },
        { status: 403 },
      );
    }
    // La publication/modération est une frontière admin. Un hôte peut éditer
    // son contenu mais ne peut pas s’auto-approuver depuis un PATCH générique.
    if (data.status !== undefined && user.role !== "admin") {
      return NextResponse.json(
        { error: await apiError("Modification du statut réservée à l'administration") },
        { status: 403 },
      );
    }
    // T-206/F3 : le PUT générique admin ne doit pas contourner la même garde
    // que /validate. Une annonce ne peut devenir publique que si son hôte est
    // approuvé, même quand l'admin édite plusieurs champs à la fois.
    if (data.status === "active") {
      const gate = await requireApprovedHost(property.hostId);
      if (!gate.ok) {
        const suffix =
          gate.messageKey === "host.pendingApproval"
            ? " La commission et la validation du compte hôte doivent être définies avant publication."
            : "";
        return NextResponse.json(
          { error: await apiError(gate.defaultMessage + suffix) },
          { status: 409 },
        );
      }
    }

    const [updatedProperty] = await db
      .update(properties)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, id))
      .returning();

    return NextResponse.json({ property: updatedProperty });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("Error updating property:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 401 }
      );
    }
    await assertNotMaintenance(user);

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    }

    // Check ownership or admin
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id));

    if (!property) {
      return NextResponse.json(
        { error: await apiError("Hébergement non trouvé") },
        { status: 404 }
      );
    }

    if (property.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 403 }
      );
    }

    // Soft delete - archive the property
    await db
      .update(properties)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(properties.id, id));

    return NextResponse.json({ message: await apiError("Hébergement archivé") });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    console.error("Error deleting property:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
  }
}
