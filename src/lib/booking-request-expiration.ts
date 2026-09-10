/**
 * T-209 — TTL des demandes de réservation sans paiement plateforme.
 *
 * `paymentExpiresAt` reste réservé aux anciens holds PSP. Les demandes
 * manuelles utilisent `requestExpiresAt` afin de libérer le stock sans
 * réactiver la sémantique « paiement à finaliser ».
 */
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
