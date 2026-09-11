import { Award, Star } from "lucide-react";
import { ReviewHelpfulButton } from "@/components/review-helpful-button";
import { countryLabel, travelerTypeLabel } from "@/lib/country-label";
import { formatDate } from "@/lib/utils";
import type { UiStringKey } from "@/lib/ui-strings";

/**
 * T-258 (audit n°6, B5) — liste d'avis partagée entre la fiche publique
 * (5 derniers avis) et la page « tous les avis » (`/hebergement/<slug>/avis`).
 *
 * Le balisage est celui de la fiche depuis T-154/T-236 : aucune régression
 * visuelle, la page dédiée réutilise exactement le même rendu (réponse d'hôte,
 * commentaires 👍/👎, pays, type de voyageur, votes « utile »).
 */

export interface PropertyReviewEntry {
  review: {
    id: string;
    userId: string;
    overallRating: string | number;
    positiveComment: string | null;
    negativeComment: string | null;
    hostReply: string | null;
    helpfulCount: number | null;
    travelerType: string | null;
    createdAt: Date | string;
  };
  user: {
    firstName: string | null;
    lastName: string | null;
    country: string | null;
  } | null;
}

export function PropertyReviewsList({
  reviews,
  locale,
  t,
  viewerId,
  emptyHint,
}: {
  reviews: PropertyReviewEntry[];
  locale: string;
  t: (key: UiStringKey) => string;
  viewerId?: string;
  /** Message d'état vide (défaut : « Nouveau partenaire — pas encore d'avis »). */
  emptyHint?: string;
}) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-8">
        <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500">{emptyHint ?? t("property.newPartner")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map(({ review, user: reviewer }) => (
        <div key={review.id} className="border-b border-gray-100 pb-6 last:border-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white font-medium">
                {reviewer?.firstName?.charAt(0)}
                {reviewer?.lastName?.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {reviewer?.firstName} {reviewer?.lastName?.charAt(0)}.
                </p>
                <p className="text-sm text-gray-500">
                  {review.travelerType && <span>{travelerTypeLabel(review.travelerType, t)}</span>}
                  {reviewer?.country && ` · ${countryLabel(reviewer.country, t)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm font-medium">
              <Star className="w-3 h-3 text-[#F5A623] fill-current" />
              {parseFloat(String(review.overallRating)).toFixed(1)}
            </div>
          </div>
          {review.positiveComment && (
            <p className="text-gray-700 mb-2">
              <span className="text-green-600 font-medium">👍</span> {review.positiveComment}
            </p>
          )}
          {review.negativeComment && (
            <p className="text-gray-600 text-sm">
              <span className="text-gray-400">👎</span> {review.negativeComment}
            </p>
          )}
          {review.hostReply && (
            <div className="mt-3 ml-3 border-l-2 border-[#1B3A6B] bg-blue-50/60 p-3 rounded-r-lg">
              <p className="text-xs font-semibold text-[#1B3A6B]">{t("property.hostReply")}</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{review.hostReply}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">{formatDate(review.createdAt, undefined, locale)}</p>
          <ReviewHelpfulButton
            reviewId={review.id}
            initialCount={review.helpfulCount}
            isOwn={review.userId === viewerId}
          />
        </div>
      ))}
    </div>
  );
}
