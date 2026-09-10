/**
 * T-209 — TTL des demandes de réservation sans paiement plateforme.
 *
 * `paymentExpiresAt` reste réservé aux anciens holds PSP. Les demandes
 * manuelles utilisent `requestExpiresAt` afin de libérer le stock sans
 * réactiver la sémantique « paiement à finaliser ».
 */
import { db } from "@/db";
import { bookings, promotions, users } from "@/db/schema";
import { and, eq, gt, isNull, lt, lte, ne, sql } from "drizzle-orm";

export const DEFAULT_BOOKING_REQUEST_TTL_HOURS = 24;
export const MAX_BOOKING_REQUEST_TTL_HOURS = 168; // 7 jours, borne anti-mauvaise config

export function bookingRequestTtlHours(raw = process.env.BOOKING_REQUEST_TTL_HOURS): number {
  if (!raw) return DEFAULT_BOOKING_REQUEST_TTL_HOURS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_BOOKING_REQUEST_TTL_HOURS;
  const hours = Math.floor(parsed);
  if (hours < 1) return DEFAULT_BOOKING_REQUEST_TTL_HOURS;
  return Math.min(hours, MAX_BOOKING_REQUEST_TTL_HOURS);
}

export function bookingRequestExpiresAt(
  now = new Date(),
  ttlHours = bookingRequestTtlHours(),
): Date {
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
}

export const BOOKING_REQUEST_EXPIRED_REASON =
  "Demande de réservation expirée automatiquement faute de confirmation de l'hôte";

/** Exécuteur compatible `db` ou transaction Drizzle. */
type Executor = Pick<typeof db, "select" | "update">;

export interface ExpiredRequest {
  id: string;
  bookingReference: string;
  guestEmail: string;
  guestFirstName: string;
  checkIn: string;
  checkOut: string;
  propertyId: string;
}

/**
 * Libelle d'une demande expirée, **dans l'exécuteur fourni**.
 *
 * Cœur partagé entre le cron (transaction par réservation + e-mail) et le
 * tunnel de réservation (transaction de création, sans e-mail : les
 * notifications partent après le commit).
 *
 * Verrou pessimiste + relecture : deux processus concurrents ne peuvent pas
 * expirer la même demande deux fois, ni expirer une demande qui vient d'être
 * confirmée.
 */
export async function expireRequestInExecutor(
  executor: Executor,
  candidateId: string,
  now: Date,
): Promise<ExpiredRequest | null> {
  const [booking] = await executor
    .select()
    .from(bookings)
    .where(eq(bookings.id, candidateId))
    .for("update");

  if (
    !booking ||
    booking.status !== "pending" ||
    booking.paymentStatus !== "pending" ||
    booking.paymentIntentId ||
    !booking.requestExpiresAt ||
    booking.requestExpiresAt > now
  ) {
    return null;
  }

  // T-209 : une demande expirée rend l'usage de promotion et les crédits
  // portefeuille qu'elle avait consommés (même logique que l'annulation).
  if (booking.promotionId) {
    await executor
      .update(promotions)
      .set({ currentUses: sql`GREATEST(${promotions.currentUses} - 1, 0)` })
      .where(eq(promotions.id, booking.promotionId));
  }
  const walletUsed = Number(booking.walletCreditsUsed ?? "0");
  if (walletUsed > 0 && booking.userId) {
    const [user] = await executor
      .select()
      .from(users)
      .where(eq(users.id, booking.userId))
      .for("update");
    if (user) {
      await executor
        .update(users)
        .set({
          walletBalance: (Number(user.walletBalance ?? "0") + walletUsed).toFixed(2),
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
    }
  }

  await executor
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: BOOKING_REQUEST_EXPIRED_REASON,
      benefitsReleasedAt: now,
      requestExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(bookings.id, booking.id));

  return {
    id: booking.id,
    bookingReference: booking.bookingReference,
    guestEmail: booking.guestEmail,
    guestFirstName: booking.guestFirstName,
    checkIn: String(booking.checkIn).slice(0, 10),
    checkOut: String(booking.checkOut).slice(0, 10),
    propertyId: booking.propertyId,
  };
}

/**
 * Expire les demandes candidates, **en réutilisant la transaction de
 * l'appelant** (T-234 : le tunnel doit libérer les dates qu'il s'apprête à
 * réserver, sans attendre le cron quotidien).
 *
 * Retourne les demandes expirées pour que l'appelant notifie après le commit.
 */
export async function expireRequestsInTransaction(
  executor: Executor,
  now: Date,
  scope?: { roomId?: string; checkIn?: string; checkOut?: string },
): Promise<ExpiredRequest[]> {
  const scopeConditions = [
    eq(bookings.status, "pending"),
    eq(bookings.paymentStatus, "pending"),
    isNull(bookings.paymentIntentId),
    lte(bookings.requestExpiresAt, now),
  ];
  if (scope?.roomId) {
    scopeConditions.push(eq(bookings.roomId, scope.roomId));
  }
  // Chevauchement avec la fenêtre demandée seulement si elle est fournie :
  // la requête reste sinon une purge globale (comportement du cron).
  if (scope?.checkIn && scope?.checkOut) {
    scopeConditions.push(lt(bookings.checkIn, scope.checkOut));
    scopeConditions.push(gt(bookings.checkOut, scope.checkIn));
    scopeConditions.push(ne(bookings.status, "cancelled"));
  }

  const candidates = await executor
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...scopeConditions))
    .limit(100);

  const expired: ExpiredRequest[] = [];
  for (const candidate of candidates) {
    const result = await expireRequestInExecutor(executor, candidate.id, now);
    if (result) expired.push(result);
  }
  return expired;
}

/**
 * T-209/F1 — expire les demandes manuelles restées `pending` au-delà de leur
 * TTL métier (tâche de fond). Conservateur contre le surbooking : les demandes
 * bloquent bien le stock pendant le délai, puis le cron les annule pour libérer
 * la chambre. Ne touche jamais aux anciens holds de paiement (`paymentIntentId`
 * présent), ni aux réservations confirmées/annulées.
 *
 * Chaque candidat a sa propre transaction ; les notifications sont renvoyées à
 * l'appelant (`onExpired`) qui les envoie **après** le commit.
 */
export async function expireManualBookingRequests(
  now = new Date(),
  onExpired?: (expired: ExpiredRequest) => Promise<void>,
): Promise<number> {
  const candidates = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.status, "pending"),
      eq(bookings.paymentStatus, "pending"),
      isNull(bookings.paymentIntentId),
      lte(bookings.requestExpiresAt, now),
    ))
    .limit(100);

  let expired = 0;
  for (const candidate of candidates) {
    const changed = await db.transaction((tx) =>
      expireRequestInExecutor(tx as unknown as Executor, candidate.id, now),
    );
    if (changed) {
      expired += 1;
      if (onExpired) {
        // Best-effort : un échec d'e-mail ne remet pas en cause l'expiration
        // déjà committée.
        try {
          await onExpired(changed);
        } catch (error) {
          console.error("[expiration] notification impossible :", error);
        }
      }
    }
  }
  return expired;
}
