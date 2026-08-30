import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { frenchZodMessage } from "@/lib/http";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { validateRoomCapacity, ROOM_MAX_QUANTITY } from "@/lib/room-validation";

const roomSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(3),
  description: z.string().optional(),
  roomType: z.enum(["single", "double", "twin", "suite", "studio", "dormitory", "family"]),
  bedConfiguration: z.array(z.object({
    type: z.string(),
    count: z.number(),
  })).optional(),
  maxOccupancy: z.number().int().min(1),
  maxAdults: z.number().int().min(1),
  maxChildren: z.number().int().min(0).optional(),
  sizeSqm: z.number().optional(),
  quantity: z.number().int().min(1).max(ROOM_MAX_QUANTITY, `La quantité ne peut pas dépasser ${ROOM_MAX_QUANTITY}`).optional(),
  basePrice: z.number().positive("Le prix de base doit être strictement positif"),
  currency: z.string().length(3).optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId est requis" },
        { status: 400 }
      );
    }

    const propertyRooms = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.propertyId, propertyId), eq(rooms.isActive, true)));

    return NextResponse.json({ rooms: propertyRooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "host" && user.role !== "admin")) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = roomSchema.parse(body);

    // T-129 : cohérence des capacités (adultes/enfants vs occupation) et tarif > 0.
    const capacityError = validateRoomCapacity({
      maxOccupancy: data.maxOccupancy,
      maxAdults: data.maxAdults,
      maxChildren: data.maxChildren ?? 0,
      basePrice: data.basePrice,
      quantity: data.quantity ?? null,
    });
    if (capacityError) {
      return NextResponse.json({ error: capacityError }, { status: 400 });
    }

    // Check property ownership
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, data.propertyId));

    if (!property) {
      return NextResponse.json(
        { error: "Hébergement non trouvé" },
        { status: 404 }
      );
    }

    if (property.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    const [newRoom] = await db
      .insert(rooms)
      .values({
        ...data,
        basePrice: data.basePrice.toFixed(2),
        sizeSqm: data.sizeSqm?.toFixed(2),
        amenities: data.amenities || [],
        images: data.images || [],
      })
      .returning();

    return NextResponse.json({ room: newRoom }, { status: 201 });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: frenchZodMessage(error) },
        { status: 400 }
      );
    }
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
