import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, properties, users, bookings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";
import { rateLimit } from "@/lib/rate-limit";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const status = searchParams.get("status") || "approved";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const user = await getCurrentUser();

    let conditions = [eq(reviews.status, status)];

    if (propertyId) {
      conditions.push(eq(reviews.propertyId, propertyId));
    } else if (user?.role === "host") {
      // Get host's properties reviews
      const hostProperties = await db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.hostId, user.id));
      
      if (hostProperties.length === 0) {
        return NextResponse.json({ reviews: [] });
      }
    }

    const results = await db
      .select({
        review: reviews,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          country: users.country,
        },
        property: {
          id: properties.id,
          name: properties.name,
          city: properties.city,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .leftJoin(properties, eq(reviews.propertyId, properties.id))
      .where(and(...conditions))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ reviews: results });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }
    // T-022 : mode maintenance
    await assertNotMaintenance(user);

    // T-028 : rate-limit — 20 avis/heure/user (largement au-dessus
    // du besoin réel, empêche le spam de faux avis).
    const rl = rateLimit(`reviews:user:${user.id}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop d'avis publiés, réessayez plus tard" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const body = await request.json();
    const data = reviewSchema.parse(body);

    // Get booking and verify ownership
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, data.bookingId));

    if (!booking) {
      return NextResponse.json(
        { error: "Réservation non trouvée" },
        { status: 404 }
      );
    }

    if (booking.userId !== user.id) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    if (booking.status !== "completed") {
      return NextResponse.json(
        { error: "Vous ne pouvez laisser un avis qu'après votre séjour" },
        { status: 400 }
      );
    }

    // Check if review already exists
    const existingReview = await db
      .select()
      .from(reviews)
      .where(eq(reviews.bookingId, data.bookingId));

    if (existingReview.length > 0) {
      return NextResponse.json(
        { error: "Vous avez déjà laissé un avis pour cette réservation" },
        { status: 400 }
      );
    }

    const [newReview] = await db
      .insert(reviews)
      .values({
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
      })
      .returning();

    // T-007 (BUG-010) : recalcul atomique en SQL — plus de race entre
    // deux POST /api/reviews concurrents. Une seule requête, valeurs
    // dérivées de la table `reviews` elle-même.
    await db.execute(sql`
      UPDATE properties
         SET average_rating = sub.avg_rating,
             total_reviews  = sub.total
        FROM (
          SELECT ROUND(AVG(overall_rating)::numeric, 1) AS avg_rating,
                 COUNT(*)                              AS total
            FROM reviews
           WHERE property_id = ${booking.propertyId}
             AND status      = 'approved'
        ) AS sub
       WHERE properties.id = ${booking.propertyId};
    `);

    return NextResponse.json({ review: newReview }, { status: 201 });
  } catch (error) {
    if (error instanceof MaintenanceError) {
      return maintenanceResponse(error.retryAfterSeconds);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating review:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
