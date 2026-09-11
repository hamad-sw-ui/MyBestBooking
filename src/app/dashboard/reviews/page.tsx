import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { reviews, properties, users } from "@/db/schema";
import { count, eq, desc, or } from "drizzle-orm";
import { ReviewsManager, type ReviewRow } from "@/components/bulk/reviews-manager";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { ShowMore } from "@/components/ui/show-more";
import { parsePageWindow } from "@/lib/page-window";

/**
 * T-245 (audit n°5, A2) : fenêtre de chargement (le tableau chargeait tous les
 * avis de la plateforme pour un admin). Filtres et actions groupées de
 * `ReviewsManager` inchangés, appliqués à la fenêtre affichée.
 */
async function getReviews(userId: string, isAdmin: boolean, limit: number) {
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
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
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
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

async function countReviews(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    const [row] = await db.select({ total: count() }).from(reviews);
    return row?.total ?? 0;
  }
  const [row] = await db
    .select({ total: count() })
    .from(reviews)
    .leftJoin(properties, eq(reviews.propertyId, properties.id))
    .where(eq(properties.hostId, userId));
  return row?.total ?? 0;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const t = makeT(await getServerLocale());
  const window = parsePageWindow((await searchParams).limit);
  const [rows, total] = await Promise.all([
    getReviews(user.id, isAdmin, window.queryLimit),
    countReviews(user.id, isAdmin),
  ]);
  const visible = rows.slice(0, window.size);

  const serialized: ReviewRow[] = visible.map((r) => ({
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
          {isAdmin ? t("dash.reviewsModeration") : t("dash.reviews")}
        </h1>
        <p className="text-gray-600 mt-1">
          {isAdmin ? t("dash.reviewsAdminSub") : t("dash.reviewsHostSub")}
        </p>
      </div>
      <ReviewsManager reviews={serialized} isAdmin={isAdmin} />
      <ShowMore
        shown={visible.length}
        total={total}
        hasMore={rows.length > visible.length}
        basePath="/dashboard/reviews"
        params={{}}
        labels={{
          shown: t("list.window.shown"),
          showMore: t("list.window.showMore"),
          showAll: t("list.window.showAll"),
          limitReached: t("list.window.limitReached"),
          filterScope: t("list.window.filterScope"),
        }}
      />
    </div>
  );
}
