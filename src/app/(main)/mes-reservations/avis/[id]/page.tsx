import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isReviewEligible, type BookingStatus } from "@/lib/booking-lifecycle";
import { isUuid } from "@/lib/http";
import { getSetting } from "@/lib/settings";
import { ReviewForm } from "@/components/reviews/review-form";

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
 */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  if (!isUuid(id)) notFound();

  const [booking] = await db
    .select({ id: bookings.id, userId: bookings.userId, status: bookings.status, checkOut: bookings.checkOut })
    .from(bookings)
    .where(eq(bookings.id, id));

  if (!booking || booking.userId !== user.id) notFound();
  if (!isReviewEligible(booking.status as BookingStatus, booking.checkOut)) notFound();

  const { requireModeration } = await getSetting("reviews");

  return <ReviewForm bookingId={booking.id} requireModeration={requireModeration} />;
}
