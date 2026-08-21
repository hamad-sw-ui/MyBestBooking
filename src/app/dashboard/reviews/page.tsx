import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { reviews, properties, users } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { ReviewsManager, type ReviewRow } from "@/components/bulk/reviews-manager";

async function getReviews(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return db
      .select({
        review: reviews,
        property: {
          id: properties.id,
          name: properties.name,
          city: properties.city,
        },
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          country: users.country,
        },
      })
      .from(reviews)
      .leftJoin(properties, eq(reviews.propertyId, properties.id))
      .leftJoin(users, eq(reviews.userId, users.id))
      .orderBy(desc(reviews.createdAt));
  }
  const hostProperties = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.hostId, userId));
  if (hostProperties.length === 0) return [];
  const propertyIds = hostProperties.map((p) => p.id);
  return db
    .select({
      review: reviews,
      property: {
        id: properties.id,
        name: properties.name,
        city: properties.city,
      },
      user: {
        firstName: users.firstName,
        lastName: users.lastName,
        country: users.country,
      },
    })
    .from(reviews)
    .leftJoin(properties, eq(reviews.propertyId, properties.id))
    .leftJoin(users, eq(reviews.userId, users.id))
    .where(or(...propertyIds.map((id) => eq(reviews.propertyId, id))))
    .orderBy(desc(reviews.createdAt));
}

export default async function ReviewsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const rows = await getReviews(user.id, isAdmin);

  const serialized: ReviewRow[] = rows.map((r) => ({
    review: {
      id: r.review.id,
      overallRating: String(r.review.overallRating),
      cleanlinessRating: r.review.cleanlinessRating,
      comfortRating: r.review.comfortRating,
      locationRating: r.review.locationRating,
      staffRating: r.review.staffRating,
      valueRating: r.review.valueRating,
      positiveComment: r.review.positiveComment,
      negativeComment: r.review.negativeComment,
      travelerType: r.review.travelerType,
      status: r.review.status,
      hostReply: r.review.hostReply,
      createdAt:
        r.review.createdAt instanceof Date
          ? r.review.createdAt.toISOString()
          : String(r.review.createdAt),
    },
    property: r.property,
    user: r.user,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Avis {isAdmin && "(modération)"}
        </h1>
        <p className="text-gray-600 mt-1">
          {isAdmin
            ? "Modérez les avis — filtres, sélection multiple, actions groupées."
            : "Consultez les avis sur vos hébergements et répondez publiquement."}
        </p>
      </div>
      <ReviewsManager reviews={serialized} isAdmin={isAdmin} />
    </div>
  );
}
