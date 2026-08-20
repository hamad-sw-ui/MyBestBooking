import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { reviews, properties, users, bookings } from "@/db/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, getRatingLabel } from "@/lib/utils";
import { Star, MessageSquare, ThumbsUp, Flag } from "lucide-react";
import { HostReplyForm } from "@/components/host-reply-form";

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

  // Get host's properties
  const hostProperties = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.hostId, userId));

  if (hostProperties.length === 0) {
    return [];
  }

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
  const allReviews = await getReviews(user.id, isAdmin);

  // Calculate stats
  const avgRating = allReviews.length > 0
    ? allReviews.reduce((sum, r) => sum + parseFloat(r.review.overallRating), 0) / allReviews.length
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Avis vérifiés
        </h1>
        <p className="text-gray-600 mt-1">
          {isAdmin ? "Tous les avis de la plateforme" : "Les avis de vos hébergements"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{allReviews.length}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Note moyenne</p>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-[#F5A623] fill-current" />
              <p className="text-2xl font-bold">{avgRating.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Positifs (≥8)</p>
            <p className="text-2xl font-bold text-green-600">
              {allReviews.filter(r => parseFloat(r.review.overallRating) >= 8).length}
            </p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">À améliorer (&lt;6)</p>
            <p className="text-2xl font-bold text-red-600">
              {allReviews.filter(r => parseFloat(r.review.overallRating) < 6).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      <Card padding="none">
        {allReviews.length === 0 ? (
          <EmptyState
            icon={<Star className="w-8 h-8" />}
            title="Aucun avis"
            description="Les avis de vos voyageurs apparaîtront ici"
            className="py-16"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {allReviews.map(({ review, property, user: reviewer }) => {
              const rating = parseFloat(review.overallRating);
              const ratingInfo = getRatingLabel(rating);

              return (
                <div key={review.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white font-medium">
                        {reviewer?.firstName?.charAt(0)}{reviewer?.lastName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {reviewer?.firstName} {reviewer?.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {review.travelerType && (
                            <span className="capitalize">{review.travelerType}</span>
                          )}
                          {reviewer?.country && ` · ${reviewer.country}`}
                          {` · ${formatDate(review.createdAt, { day: "numeric", month: "short", year: "numeric" })}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2 py-1 bg-[#1B3A6B] text-white font-semibold rounded">
                        <Star className="w-3 h-3 fill-current" />
                        {rating.toFixed(1)}
                      </div>
                      <span className="text-sm text-gray-600">
                        {ratingInfo.emoji} {ratingInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-gray-500">
                      Hébergement: <span className="font-medium text-gray-900">{property?.name}</span> ({property?.city})
                    </p>
                  </div>

                  {review.positiveComment && (
                    <div className="mb-2 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="text-green-600 font-medium">👍 Ce qui a plu :</span>{" "}
                        {review.positiveComment}
                      </p>
                    </div>
                  )}

                  {review.negativeComment && (
                    <div className="mb-2 p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="text-red-600 font-medium">👎 À améliorer :</span>{" "}
                        {review.negativeComment}
                      </p>
                    </div>
                  )}

                  {/* Rating breakdown */}
                  <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
                    {review.cleanlinessRating && (
                      <span>🧹 Propreté: {review.cleanlinessRating}/10</span>
                    )}
                    {review.comfortRating && (
                      <span>🛋️ Confort: {review.comfortRating}/10</span>
                    )}
                    {review.locationRating && (
                      <span>📍 Emplacement: {review.locationRating}/10</span>
                    )}
                    {review.staffRating && (
                      <span>👨‍💼 Personnel: {review.staffRating}/10</span>
                    )}
                    {review.valueRating && (
                      <span>💰 Rapport Q/P: {review.valueRating}/10</span>
                    )}
                  </div>

                  {/* Host reply */}
                  {review.hostReply && (
                    <div className="mt-4 ml-6 p-3 bg-gray-50 border-l-4 border-[#1B3A6B] rounded-r-lg">
                      <p className="text-sm font-medium text-gray-700 mb-1">Réponse de l&apos;hébergeur</p>
                      <p className="text-sm text-gray-600">{review.hostReply}</p>
                    </div>
                  )}

                  {/* Actions — T-016 : formulaire branché */}
                  {!isAdmin && (
                    <div className="mt-4">
                      <HostReplyForm reviewId={review.id} initialReply={review.hostReply} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
