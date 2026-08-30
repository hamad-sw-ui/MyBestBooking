import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties, reviews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isReviewEligible, type BookingStatus } from "@/lib/booking-lifecycle";
import { isUuid } from "@/lib/http";
import { getSetting } from "@/lib/settings";
import { ReviewForm } from "@/components/reviews/review-form";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import Link from "next/link";

/**
 * Page de dépôt d'avis (T-125, P4).
 *
 * Anciennement un simple composant client qui répondait 200 pour n'importe
 * quel identifiant : l'utilisateur ne découvrait l'erreur qu'à la
 * soumission. La page est désormais un Server Component qui vérifie
 *  - l'authentification,
 *  - la validité de l'UUID,
 *  - l'existence de la réservation et son appartenance à l'utilisateur,
 *  - l'éligibilité (séjour terminé),
 * avant de rendre le formulaire. L'API conserve ses propres garde-fous
 * (404/403/400) : cette garde améliore l'UX et évite les formulaires morts.
 * Les sous-notes par critère (T-115) et la logique de soumission vivent dans
 * le composant client <ReviewForm/>.
 *
 * T-152 (audit n°24, E) : si un avis existe déjà pour la réservation, on
 * affiche son état (note + statut) au lieu de re-proposer le formulaire —
 * le POST /api/reviews aurait sinon renvoyé le 400 « Vous avez déjà laissé
 * un avis » sans contexte.
 */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  if (!isUuid(id)) notFound();

  const [row] = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      status: bookings.status,
      checkOut: bookings.checkOut,
      property: {
        id: properties.id,
        name: properties.name,
        slug: properties.slug,
      },
      review: {
        id: reviews.id,
        overallRating: reviews.overallRating,
        status: reviews.status,
      },
    })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(eq(bookings.id, id));

  if (!row || row.userId !== user.id) notFound();
  if (!isReviewEligible(row.status as BookingStatus, row.checkOut)) notFound();

  const t = makeT(await getServerLocale());

  if (row.review?.id) {
    const label =
      row.review.status === "approved"
        ? `✓ ${t("bookings.reviewPublished")}`
        : row.review.status === "pending"
          ? t("bookings.reviewPending")
          : t("bookings.reviewSubmitted");
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-xl mx-auto px-4">
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <Star className="w-8 h-8 text-green-700 fill-current" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {t("bookings.alreadyReviewed")}
              </h1>
              <div className="inline-block px-4 py-2 bg-green-50 rounded-lg text-green-800 text-sm font-medium">
                {label}
              </div>
              <p className="text-gray-600 mt-4">
                {t("bookings.yourRating")} : <strong>{row.review.overallRating ?? "–"}/10</strong>
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                {row.property?.slug && (
                  <Link href={`/hebergement/${row.property.slug}`}>
                    <Button variant="outline">{t("bookings.viewAccommodation")}</Button>
                  </Link>
                )}
                <Link href="/mes-reservations">
                  <Button>{t("bookings.reviewBack")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { requireModeration } = await getSetting("reviews");

  return <ReviewForm bookingId={row.id} requireModeration={requireModeration} />;
}
