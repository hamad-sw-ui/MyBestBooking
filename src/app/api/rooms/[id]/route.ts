import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, frenchZodMessage } from "@/lib/http";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validateRoomCapacity, ROOM_MAX_QUANTITY } from "@/lib/room-validation";
import { apiError } from "@/lib/api-error";

const updateRoomSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  roomType: z.enum(["single", "double", "twin", "suite", "studio", "dormitory", "family"]).optional(),
  bedConfiguration: z.array(z.object({
    type: z.string(),
    count: z.number(),
  })).optional(),
  maxOccupancy: z.number().int().min(1).optional(),
  maxAdults: z.number().int().min(1).optional(),
  maxChildren: z.number().int().min(0).optional(),
  sizeSqm: z.number().optional(),
  quantity: z.number().int().min(1).max(ROOM_MAX_QUANTITY, `La quantité ne peut pas dépasser ${ROOM_MAX_QUANTITY}`).optional(),
  basePrice: z.number().positive("Le prix de base doit être strictement positif").optional(),
  currency: z.string().length(3).optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    }

    const [row] = await db
      .select({ room: rooms, property: properties })
      .from(rooms)
      .leftJoin(properties, eq(rooms.propertyId, properties.id))
      .where(eq(rooms.id, id));

    if (!row?.room || !row.property) {
      return NextResponse.json({ error: await apiError("Chambre non trouvée") }, { status: 404 });
    }
    const user = await getCurrentUser();
    const canSeePrivate = user?.role === "admin" || row.property.hostId === user?.id;
    if ((!row.room.isActive || row.property.status !== "active") && !canSeePrivate) {
      return NextResponse.json({ error: await apiError("Chambre non trouvée") }, { status: 404 });
    }

    return NextResponse.json({ room: row.room });
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
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

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    }
    const body = await request.json();
    const data = updateRoomSchema.parse(body);

    // Get room and check ownership
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    if (!room) {
      return NextResponse.json(
        { error: await apiError("Chambre non trouvée") },
        { status: 404 }
      );
    }

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, room.propertyId));

    if (property.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 403 }
      );
    }

    // T-129 : cohérence des capacités sur le résultat final (valeurs éditées
    // fusionnées avec l'existant), pour refuser une mise à jour qui rendrait la
    // chambre incohérente (ex. capacité réduite sous le nombre d'adultes).
    const capacityError = validateRoomCapacity({
      maxOccupancy: data.maxOccupancy ?? room.maxOccupancy,
      maxAdults: data.maxAdults ?? room.maxAdults,
      maxChildren: data.maxChildren ?? room.maxChildren ?? 0,
      basePrice: data.basePrice !== undefined ? data.basePrice : Number(room.basePrice),
      quantity: data.quantity ?? room.quantity ?? null,
    });
    if (capacityError) {
      return NextResponse.json({ error: await apiError(capacityError) }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.basePrice !== undefined) {
      updateData.basePrice = data.basePrice.toFixed(2);
    }
    if (data.sizeSqm !== undefined) {
      updateData.sizeSqm = data.sizeSqm.toFixed(2);
    }

    const [updatedRoom] = await db
      .update(rooms)
      .set(updateData)
      .where(eq(rooms.id, id))
      .returning();

    return NextResponse.json({ room: updatedRoom });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: await apiError(frenchZodMessage(error)) },
        { status: 400 }
      );
    }
    console.error("Error updating room:", error);
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

    const { id } = await params;

    // Get room and check ownership
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    if (!room) {
      return NextResponse.json(
        { error: await apiError("Chambre non trouvée") },
        { status: 404 }
      );
    }

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, room.propertyId));

    if (property.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 403 }
      );
    }

    // Soft delete
    await db
      .update(rooms)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(rooms.id, id));

    return NextResponse.json({ message: "Chambre supprimée" });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
  }
}
