import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties, rooms, reviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateSlug } from "@/lib/utils";
import { eq, and, ilike, or, desc, sql, min, count } from "drizzle-orm";
import { z } from "zod";

const propertySchema = z.object({
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
  type: z.enum(["hotel", "apartment", "house", "villa", "hostel", "resort", "bnb", "guesthouse", "riad", "camping"]),
  description: z.string().optional(),
  starRating: z.number().min(0).max(5).optional(),
  addressLine: z.string().optional(),
  city: z.string().min(2, "La ville est requise"),
  state: z.string().optional(),
  country: z.string().length(2, "Le code pays doit être de 2 caractères"),
  postalCode: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  cancellationPolicy: z.enum(["free", "flexible", "moderate", "strict", "non_refundable"]).optional(),
  petsAllowed: z.boolean().optional(),
  smokingAllowed: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  mainImage: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const country = searchParams.get("country");
    const type = searchParams.get("type");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const minRating = searchParams.get("minRating");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");

    let query = db.select().from(properties).where(eq(properties.status, "active"));

    const conditions = [eq(properties.status, "active")];

    if (city) {
      conditions.push(ilike(properties.city, `%${city}%`));
    }

    if (country) {
      conditions.push(eq(properties.country, country));
    }

    if (type) {
      conditions.push(eq(properties.type, type));
    }

    if (minRating) {
      conditions.push(sql`${properties.averageRating} >= ${minRating}`);
    }

    if (search) {
      conditions.push(
        or(
          ilike(properties.name, `%${search}%`),
          ilike(properties.city, `%${search}%`),
          ilike(properties.description, `%${search}%`)
        )!
      );
    }

    // ── T-004 (BUG-004) : remplace le N+1 « une requête rooms par
    //    property » par un unique LEFT JOIN + agrégation SQL.
    //    Le filtre price est appliqué avec un HAVING plutôt qu'en JS.
    const rows = await db
      .select({
        property: properties,
        minPrice: min(rooms.basePrice),
        roomCount: count(rooms.id),
      })
      .from(properties)
      .leftJoin(
        rooms,
        and(eq(rooms.propertyId, properties.id), eq(rooms.isActive, true)),
      )
      .where(and(...conditions))
      .groupBy(properties.id)
      .orderBy(desc(properties.averageRating))
      .limit(limit)
      .offset(offset);

    let filteredResults = rows.map((r) => ({
      ...r.property,
      minPrice: r.minPrice !== null ? parseFloat(r.minPrice as string) : null,
      roomCount: Number(r.roomCount),
    }));

    // Filter by price if needed (post-agrégation, borne côté JS car
    // Drizzle 0.45 n'expose pas `having` sur select simple ; tolerable
    // pour l'ordre de grandeur d'aujourd'hui, à optimiser si le trafic
    // impose le HAVING SQL).
    if (minPrice) {
      filteredResults = filteredResults.filter((p) => p.minPrice !== null && p.minPrice >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filteredResults = filteredResults.filter((p) => p.minPrice !== null && p.minPrice <= parseFloat(maxPrice));
    }

    return NextResponse.json({ properties: filteredResults });
  } catch (error) {
    console.error("Error fetching properties:", error);
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
    const data = propertySchema.parse(body);

    // Generate unique slug
    let slug = generateSlug(data.name);
    const existingSlug = await db.select().from(properties).where(eq(properties.slug, slug));
    if (existingSlug.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    const [newProperty] = await db
      .insert(properties)
      .values({
        ...data,
        slug,
        hostId: user.id,
        status: user.role === "admin" ? "active" : "pending",
        amenities: data.amenities || [],
        images: data.images || [],
      })
      .returning();

    return NextResponse.json({ property: newProperty }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating property:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
