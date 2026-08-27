import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, properties, users, bookings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";
import { rateLimit } from "@/lib/rate-limit";
import { isReviewEligible, type BookingStatus } from "@/lib/booking-lifecycle";
import { recomputePropertyReviewAggregate } from "@/lib/review-aggregates";

const reviewSchema = z.object({
  bookingId: z.string().uuid(),
  overallRating: z.number().min(1).max(10),
  cleanlinessRating: z.number().min(1).max(10).optional(),
  comfortRating: z.number().min(1).max(10).optional(),
  locationRating: z.number().min(1).max(10).optional(),
  facilitiesRating: z.number().min(1).max(10).optional(),
  staffRating: z.number().min(1).max(10).optional(),
  valueRating: z.number().min(1).max(10).optional(),
  wifiRating: z.number().min(1).max(10).optional(),
  positiveComment: z.string().optional(),
  negativeComment: z.string().optional(),
  travelerType: z.enum(["solo", "couple", "family", "group", "business"]).optional(),
});

const listSchema = z.object({
  propertyId: z.string().uuid().optional(),
  status: z.enum(["approved", "hidden", "rejected", "pending"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

/**
 * Public = avis approuvés uniquement. Les avis modérés restent visibles aux
 * dashboards admin et hôte propriétaire, jamais grâce à un simple query param.
 */
export async function GET(request: NextRequest) {
  try {
    const parsed = listSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const user = await getCurrentUser();
    const requestedStatus = parsed.status ?? "approved";
    const conditions = [];

    if (user?.role === "admin") {
      conditions.push(eq(reviews.status, requestedStatus));
      if (parsed.propertyId) conditions.push(eq(reviews.propertyId, parsed.propertyId));
    } else if (user?.role === "host") {
      const hostProperties = await db.select({ id: properties.id }).from(properties).where(eq(properties.hostId, user.id));
      const ids = hostProperties.map((property) => property.id);
      if (!ids.length) return NextResponse.json({ reviews: [] });
      if (parsed.propertyId && !ids.includes(parsed.propertyId)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      conditions.push(eq(reviews.status, requestedStatus));
      conditions.push(parsed.propertyId ? eq(reviews.propertyId, parsed.propertyId) : inArray(reviews.propertyId, ids));
    } else {
      // Client anonyme ou voyageur : on ignore volontairement status non public.
      conditions.push(eq(reviews.status, "approved"));
      if (parsed.propertyId) conditions.push(eq(reviews.propertyId, parsed.propertyId));
    }

    const results = await db
      .select({
        review: reviews,
        user: { firstName: users.firstName, lastName: users.lastName, country: users.country },
        property: { id: properties.id, name: properties.name, city: properties.city },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .leftJoin(properties, eq(reviews.propertyId, properties.id))
      .where(and(...conditions))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(parsed.limit)
      .offset(parsed.offset);

    return NextResponse.json({ reviews: results });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Paramètres invalides" }, { status: 400 });
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    await assertNotMaintenance(user);

    const rl = rateLimit(`reviews:user:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ error: "Trop d'avis publiés, réessayez plus tard" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

    const data = reviewSchema.parse(await request.json());
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, data.bookingId));
    if (!booking) return NextResponse.json({ error: "Réservation non trouvée" }, { status: 404 });
    if (booking.userId !== user.id) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    if (!isReviewEligible(booking.status as BookingStatus, booking.checkOut)) return NextResponse.json({ error: "Vous ne pouvez laisser un avis qu'après un séjour terminé" }, { status: 400 });

    const created = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, data.bookingId)).for("update");
      if (existing) return null;
      const [review] = await tx.insert(reviews).values({
        bookingId: data.bookingId,
        userId: user.id,
        propertyId: booking.propertyId,
        overallRating: data.overallRating.toFixed(1),
        cleanlinessRating: data.cleanlinessRating,
        comfortRating: data.comfortRating,
        locationRating: data.locationRating,
        facilitiesRating: data.facilitiesRating,
        staffRating: data.staffRating,
        valueRating: data.valueRating,
        wifiRating: data.wifiRating,
        positiveComment: data.positiveComment,
        negativeComment: data.negativeComment,
        travelerType: data.travelerType,
        isVerified: true,
        status: "approved",
      }).returning();
      await recomputePropertyReviewAggregate(tx, booking.propertyId);
      return review;
    });
    if (!created) return NextResponse.json({ error: "Vous avez déjà laissé un avis pour cette réservation" }, { status: 400 });
    return NextResponse.json({ review: created }, { status: 201 });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload invalide" }, { status: 400 });
    console.error("Error creating review:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
