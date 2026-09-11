import { db } from "@/db";
import { bookings, properties, reviews, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { templates } from "@/lib/mail";
import { enqueueEmail } from "@/lib/email-outbox";
import { getSetting } from "@/lib/settings";
import { enabledFor } from "@/lib/notification-prefs";

/**
 * T-225 (audit n°2, A5) — notifications d'avis.
 *
 * Deux angles morts constatés au runtime : l'hôte n'était jamais prévenu
 * qu'un avis venait d'être publié (il ne pouvait donc pas y répondre), et
 * l'auteur d'un avis refusé ne recevait rien : sa contribution disparaissait
 * silencieusement.
 *
 * Règles :
 *  - interrupteurs admin `notifications.reviewPublished` /
 *    `notifications.reviewModerated` respectés ;
 *  - insertion dans `email_outbox` avec `eventKey` déterministe → l'idempotence
 *    est portée par la contrainte unique (un retry ne double jamais l'envoi) ;
 *  - les helpers n'échouent jamais l'appelant : un e-mail manquant ne doit pas
 *    faire échouer la publication d'un avis (erreur seulement journalisée).
 */

async function safeNotify(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn();
  } catch (error) {
    console.error("[review-notifications]", error);
    return false;
  }
}

/**
 * Notifie l'hôte de la publication d'un avis. Appelée uniquement quand l'avis
 * devient visible (`status === "approved"`).
 */
export async function notifyReviewPublished(reviewId: string): Promise<boolean> {
  return safeNotify(async () => {
    const notifications = await getSetting("notifications");
    if (!notifications.reviewPublished) return false;

    const [row] = await db
      .select({
        review: reviews,
        propertyName: properties.name,
        hostEmail: users.email,
        hostFirstName: users.firstName,
        hostLanguage: users.language,
      })
      .from(reviews)
      .leftJoin(properties, eq(reviews.propertyId, properties.id))
      .leftJoin(users, eq(properties.hostId, users.id))
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!row?.hostEmail) return false;

    const mail = await templates.reviewPublished({
      hostFirstName: row.hostFirstName ?? "",
      propertyName: row.propertyName ?? "",
      // Les notes sont stockées sur 10 (cf. reviewSchema 1..10) : on transmet
      // la valeur telle quelle, le gabarit l'affiche sur 10.
      rating: Number(row.review.overallRating),
      comment: row.review.positiveComment ?? row.review.negativeComment ?? null,
      language: row.hostLanguage ?? null,
    });
    await enqueueEmail({
      eventKey: `review-published:${reviewId}`,
      to: row.hostEmail,
      ...mail,
    });
    return true;
  });
}

/**
 * Informe l'auteur de l'avis de l'issue de la modération.
 * `status` est le statut final : `approved` → publié, `rejected`/`hidden` →
 * refusé. Les autres statuts (`pending`) ne déclenchent rien.
 */
export async function notifyReviewModerated(
  reviewId: string,
  status: string,
): Promise<boolean> {
  if (status !== "approved" && status !== "rejected" && status !== "hidden") return false;
  return safeNotify(async () => {
    const notifications = await getSetting("notifications");
    if (!notifications.reviewModerated) return false;

    const [row] = await db
      .select({
        review: reviews,
        propertyName: properties.name,
        authorEmail: users.email,
        authorFirstName: users.firstName,
        authorLanguage: users.language,
        authorPrefs: users.notificationPrefs,
        bookingReference: bookings.bookingReference,
      })
      .from(reviews)
      .leftJoin(properties, eq(reviews.propertyId, properties.id))
      .leftJoin(users, eq(reviews.userId, users.id))
      .leftJoin(bookings, eq(reviews.bookingId, bookings.id))
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!row?.authorEmail) return false;
    // T-261 (audit n°6, B9) : « décisions de modération » coupées par l'auteur
    // → pas d'e-mail (le statut de l'avis, lui, est bien appliqué).
    if (!enabledFor(row.authorPrefs, "reviewModerated", notifications.reviewModerated)) return false;

    const mail = await templates.reviewModerated({
      firstName: row.authorFirstName ?? "",
      propertyName: row.propertyName ?? "",
      bookingReference: row.bookingReference ?? "",
      approved: status === "approved",
      language: row.authorLanguage ?? null,
    });
    await enqueueEmail({
      eventKey: `review-moderated:${reviewId}:${status}`,
      to: row.authorEmail,
      ...mail,
    });
    return true;
  });
}
