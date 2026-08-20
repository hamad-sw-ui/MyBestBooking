import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateRoomSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  roomType: z.enum(["single", "double", "twin", "suite", "studio", "dormitory", "family"]).optional(),
  bedConfiguration: z.array(z.object({
    type: z.string(),
    count: z.number(),
  })).optional(),
  maxOccupancy: z.number().min(1).optional(),
  maxAdults: z.number().min(1).optional(),
  maxChildren: z.number().min(0).optional(),
  sizeSqm: z.number().optional(),
  quantity: z.number().min(1).optional(),
  basePrice: z.number().min(0).optional(),
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

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id));

    if (!room) {
      return NextResponse.json(
        { error: "Chambre non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
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
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateRoomSchema.parse(body);

    // Get room and check ownership
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    if (!room) {
      return NextResponse.json(
        { error: "Chambre non trouvée" },
        { status: 404 }
      );
    }

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, room.propertyId));

    if (property.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating room:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
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
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get room and check ownership
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    if (!room) {
      return NextResponse.json(
        { error: "Chambre non trouvée" },
        { status: 404 }
      );
    }

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, room.propertyId));

    if (property.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "Non autorisé" },
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
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
