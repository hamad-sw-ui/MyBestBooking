import { db } from "@/db";
import { bookings, emailOutbox, properties, users } from "@/db/schema";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { enqueueEmail } from "@/lib/email-outbox";
import { getSetting } from "@/lib/settings";
import { templates } from "@/lib/mail";
import type { ExpiredRequest } from "@/lib/booking-request-expiration";

/**
 * T-221 (audit n°2) — notification d'une demande expirée.
 *
 * Deux destinataires, deux `eventKey` déterministes : le cron peut être
 * relancé sans doubler les envois. Respecte l'interrupteur admin
 * `notifications.bookingRequestExpired` (défaut actif).
 */
export async function notifyExpiredRequest(candidate: ExpiredRequest): Promise<void> {
  const notifications = await getSetting("notifications");
  if (!notifications.bookingRequestExpired) return;
  const [row] = await db
    .select({
      propertyName: properties.name,
      propertyCity: properties.city,
      hostEmail: users.email,
      hostFirstName: users.firstName,
      hostLanguage: users.language,
    })
    .from(properties)
    .innerJoin(users, eq(properties.hostId, users.id))
    .where(eq(properties.id, candidate.propertyId))
    .limit(1);
  if (!row) return;
  const checkIn = String(candidate.checkIn).slice(0, 10);
  const checkOut = String(candidate.checkOut).slice(0, 10);
  const [guest] = await db
    .select({ language: users.language })
    .from(users)
    .where(eq(users.email, candidate.guestEmail))
    .limit(1);
  const travelerMail = await templates.bookingRequestExpired({
    firstName: candidate.guestFirstName,
    bookingReference: candidate.bookingReference,
    propertyName: row.propertyName,
    city: row.propertyCity,
    checkIn,
    checkOut,
    language: guest?.language ?? null,
  });
  await enqueueEmail({
    eventKey: `booking-request-expired:${candidate.id}`,
    to: candidate.guestEmail,
    ...travelerMail,
  });
  const hostMail = await templates.bookingRequestExpiredHost({
    hostFirstName: row.hostFirstName,
    bookingReference: candidate.bookingReference,
    propertyName: row.propertyName,
    guestName: candidate.guestFirstName,
    checkIn,
    checkOut,
    language: row.hostLanguage ?? null,
  });
  await enqueueEmail({
    eventKey: `booking-request-expired-host:${candidate.id}`,
    to: row.hostEmail,
    ...hostMail,
  });
}

/**
 * T-222 (audit n°2) — relance des séjours terminés dont le règlement n'a pas
 * été constaté. Un e-mail par séjour (idempotent), à l'hôte propriétaire.
 *
 * Sans cette relance, ni la clôture, ni les points de fidélité, ni
 * l'invitation d'avis, ni la facture ne peuvent aboutir : le séjour reste
 * `confirmed` indéfiniment et les indicateurs de revenu l'ignorent.
 * Fenêtre bornée (30 jours) pour ne pas re-notifier un historique ancien.
 */
