import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties, rooms, reviews, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const updatePropertySchema = z.object({
  name: z.string().min(3).optional(),
  type: z.enum(["hotel", "apartment", "house", "villa", "hostel", "resort", "bnb", "guesthouse", "riad", "camping"]).optional(),
  description: z.string().optional(),
  starRating: z.number().min(0).max(5).optional(),
  addressLine: z.string().optional(),
  city: z.string().min(2).optional(),
  state: z.string().optional(),
  country: z.string().length(2).optional(),
  postalCode: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
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
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id));

    if (!property) {
      return NextResponse.json(
        { error: "Hébergement non trouvé" },
        { status: 404 }
      );
    }

    // Get rooms
    const propertyRooms = await db
      .select()
      .from(rooms)
      .where(eq(rooms.propertyId, id));

    // Get reviews with user info
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

    // Get host info
    const [host] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, property.hostId));

    return NextResponse.json({
      property,
      rooms: propertyRooms,
      reviews: propertyReviews,
      host,
    });
  } catch (error) {
    console.error("Error fetching property:", error);
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
    const data = updatePropertySchema.parse(body);

    // Check ownership or admin
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id));

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

    // T-021 audit follow-up : commissionRate est un champ admin-only.
    // Un host ne peut jamais modifier sa propre commission.
    if (data.commissionRate !== undefined && user.role !== "admin") {
      return NextResponse.json(
        { error: "Modification de commission réservée à l'admin" },
        { status: 403 },
      );
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating property:", error);
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

    // Check ownership or admin
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id));

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

    // Soft delete - archive the property
    await db
      .update(properties)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(properties.id, id));

    return NextResponse.json({ message: "Hébergement archivé" });
  } catch (error) {
    console.error("Error deleting property:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
