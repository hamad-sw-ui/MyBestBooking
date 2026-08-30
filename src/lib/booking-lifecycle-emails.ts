import { and, eq, isNull, lte, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, emailOutbox, properties, reviews, users } from "@/db/schema";
import { templates } from "@/lib/mail";
import { toMailLocale } from "@/lib/mail/strings";
import { enqueueEmail, deliverEmail } from "@/lib/email-outbox";
import { getSetting } from "@/lib/settings";

/**
 * T-149 — E-mails de cycle de vie pilotés par le cron quotidien.
 *
 * Chaque envoi utilise une `eventKey` déterministe : l'outbox
 * (`onConflictDoNothing`) garantit qu'un rappel ou une demande d'avis
 * n'est jamais envoyé deux fois, même si la tâche est rejouée.
 *
 * Les interrupteurs admin `notifications.bookingReminderJ3 / J1` et
 * `notifications.reviewRequest` sont respectés ; les sujets et corps
 * restent éditables via `emailTemplates`.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Rappels avant l'arrivée : J-3 (3 nuits avant) et J-1 (la veille).
 * Cible uniquement les réservations confirmées et payées.
 */
export async function sendBookingReminders(today = new Date()): Promise<number> {
  const notifications = await getSetting("notifications");
  const targets: { date: string; code: "j3" | "j1"; daysLabelFr: string; daysLabelEn: string }[] = [];
  if (notifications.bookingReminderJ3) {
    targets.push({ date: toIso(addDays(today, 3)), code: "j3", daysLabelFr: "Votre arrivée est dans 3 jours", daysLabelEn: "Your check-in is in 3 days" });
  }
  if (notifications.bookingReminderJ1) {
    targets.push({ date: toIso(addDays(today, 1)), code: "j1", daysLabelFr: "Votre arrivée est demain", daysLabelEn: "Your check-in is tomorrow" });
  }
  if (targets.length === 0) return 0;

  const rows = await db
    .select({
      id: bookings.id,
      guestEmail: bookings.guestEmail,
      guestFirstName: bookings.guestFirstName,
      bookingReference: bookings.bookingReference,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      propertyName: properties.name,
      city: properties.city,
      guestLanguage: users.language,
    })
    .from(bookings)
    .innerJoin(properties, eq(properties.id, bookings.propertyId))
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(and(
      eq(bookings.status, "confirmed"),
      eq(bookings.paymentStatus, "paid"),
      inArray(bookings.checkIn, targets.map((t) => t.date)),
      // Ne re-cible pas une réservation déjà notifiée (au moins un rappel
      // J-3 ou J-1 déjà en outbox) : évite de retenter chaque jour.
      sql`NOT EXISTS (
        SELECT 1 FROM ${emailOutbox} o
        WHERE o.event_key IN (
          'booking-reminder:' || ${bookings.id}::text || ':j3',
          'booking-reminder:' || ${bookings.id}::text || ':j1'
        )
      )`,
    ));

  let sent = 0;
  for (const row of rows) {
    const target = targets.find((t) => t.date === toIso(new Date(row.checkIn)));
    if (!target) continue;
    const eventKey = `booking-reminder:${row.id}:${target.code}`;
    try {
      const loc = toMailLocale(row.guestLanguage);
      const mail = await templates.bookingReminder({
        firstName: row.guestFirstName,
        bookingReference: row.bookingReference,
        propertyName: row.propertyName ?? "",
        city: row.city ?? "",
        checkIn: String(row.checkIn),
        checkOut: String(row.checkOut),
        daysLabel: loc === "en" ? target.daysLabelEn : target.daysLabelFr,
        url: `${APP_URL}/mes-reservations`,
        language: row.guestLanguage ?? null,
      });
      await enqueueEmail({ eventKey, to: row.guestEmail, ...mail });
      await deliverEmail(eventKey);
      sent += 1;
    } catch (err) {
      console.error("[lifecycle-emails] reminder failed:", row.id, err);
    }
  }
  return sent;
}

/**
 * Fenêtre maximale pendant laquelle on propose de laisser un avis après
 * le départ : borne la requête cron pour ne pas balayer tout l'historique.
 */
const REVIEW_REQUEST_WINDOW_DAYS = 14;

/**
 * Demande d'avis pour les séjours terminés sans avis. Un avis ne pouvant
 * exister qu'une fois par réservation (`reviews.bookingId` unique), un
 * séjour déjà commenté est naturellement exclu.
 */
export async function sendReviewRequests(today = new Date()): Promise<number> {
  const notifications = await getSetting("notifications");
  if (!notifications.reviewRequest) return 0;

  const windowStart = toIso(addDays(today, -REVIEW_REQUEST_WINDOW_DAYS));
  const todayIso = toIso(today);

  const rows = await db
    .select({
      id: bookings.id,
      guestEmail: bookings.guestEmail,
      guestFirstName: bookings.guestFirstName,
      bookingReference: bookings.bookingReference,
      propertyName: properties.name,
      guestLanguage: users.language,
    })
    .from(bookings)
    .innerJoin(properties, eq(properties.id, bookings.propertyId))
    .innerJoin(users, eq(users.id, bookings.userId))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(and(
      eq(bookings.status, "completed"),
      lte(bookings.checkOut, todayIso),
      gte(bookings.checkOut, windowStart),
      isNull(reviews.id),
      // Une demande déjà en outbox (envoyée ou en attente) n'est pas recréée.
      sql`NOT EXISTS (
        SELECT 1 FROM ${emailOutbox} o
        WHERE o.event_key = 'review-request:' || ${bookings.id}::text
      )`,
    ));

  let sent = 0;
  for (const row of rows) {
    const eventKey = `review-request:${row.id}`;
    try {
      const mail = await templates.reviewRequest({
        firstName: row.guestFirstName,
        propertyName: row.propertyName ?? "",
        bookingReference: row.bookingReference,
        url: `${APP_URL}/mes-reservations/avis/${row.id}`,
        language: row.guestLanguage ?? null,
      });
      await enqueueEmail({ eventKey, to: row.guestEmail, ...mail });
      await deliverEmail(eventKey);
      sent += 1;
    } catch (err) {
      console.error("[lifecycle-emails] review request failed:", row.id, err);
    }
  }
  return sent;
}
