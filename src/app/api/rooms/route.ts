import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const roomSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(3),
  description: z.string().optional(),
  roomType: z.enum(["single", "double", "twin", "suite", "studio", "dormitory", "family"]),
  bedConfiguration: z.array(z.object({
    type: z.string(),
    count: z.number(),
  })).optional(),
  maxOccupancy: z.number().min(1),
  maxAdults: z.number().min(1),
  maxChildren: z.number().min(0).optional(),
  sizeSqm: z.number().optional(),
  quantity: z.number().min(1).optional(),
  basePrice: z.number().min(0),
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
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
