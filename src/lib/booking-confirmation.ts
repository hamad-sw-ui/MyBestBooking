import { db } from "@/db";
import { bookings, emailOutbox, properties, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { templates } from "@/lib/mail";
import { deliverEmail } from "@/lib/email-outbox";
import { getSetting } from "@/lib/settings";

/**
 * Crée les événements email dans la même transaction que le marqueur booking,
 * puis les tente hors transaction. Les retries webhook/cron partagent les
 * mêmes eventKey et ne dupliquent pas les notifications.
 *
 * T-203 : la confirmation est déclenchée par `status === "confirmed"` que le
 * paiement soit en ligne ou constaté sur place (paiement manuel, T-202/T-203).
 * La garde historique `paymentStatus === "paid"` est retirée : une réservation
 * confirmée par l'hôte (paiement sur place) doit recevoir son e-mail de
 * confirmation même si `paymentStatus` est encore `pending` (le versement
 * survient ensuite via `markPaidOffline`).
 */
export async function sendBookingConfirmationIfNeeded(bookingId: string): Promise<boolean> {
  // L'interrupteur admin `notifications.bookingConfirmation` est respecté.
  const notifications = await getSetting("notifications");
  if (!notifications.bookingConfirmation) return false;

  const eventKeys = await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!booking || booking.status !== "confirmed" || booking.confirmationEmailSentAt) return [];
    const [property] = await tx.select().from(properties).where(eq(properties.id, booking.propertyId));
    // Langue du voyageur (destinataire) : l'e-mail est localisé pour lui.
    const [guest] = booking.userId
      ? await tx.select({ language: users.language }).from(users).where(eq(users.id, booking.userId))
      : [];
    const traveller = await templates.bookingConfirmation({
      firstName: booking.guestFirstName,
      bookingReference: booking.bookingReference,
      propertyName: property?.name ?? "",
      city: property?.city ?? "",
      checkIn: String(booking.checkIn),
      checkOut: String(booking.checkOut),
      total: String(booking.total),
      currency: booking.currency,
      estimatedArrival: booking.estimatedArrival,
      language: guest?.language ?? null,
    });
    const guestKey = `booking-confirmation:${booking.id}:guest`;
    await tx.insert(emailOutbox).values({ eventKey: guestKey, to: booking.guestEmail, ...traveller }).onConflictDoNothing({ target: emailOutbox.eventKey });
    const keys = [guestKey];
    if (property?.hostId) {
      const [host] = await tx.select({ email: users.email, firstName: users.firstName, language: users.language }).from(users).where(eq(users.id, property.hostId));
      if (host) {
        const hostEmail = await templates.bookingHostNotification({
          hostFirstName: host.firstName,
          bookingReference: booking.bookingReference,
          propertyName: property.name,
          guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
          checkIn: String(booking.checkIn),
          checkOut: String(booking.checkOut),
          estimatedArrival: booking.estimatedArrival,
          language: host.language ?? null,
        });
        const hostKey = `booking-confirmation:${booking.id}:host`;
        await tx.insert(emailOutbox).values({ eventKey: hostKey, to: host.email, ...hostEmail }).onConflictDoNothing({ target: emailOutbox.eventKey });
        keys.push(hostKey);
      }
    }
    await tx.update(bookings).set({ confirmationEmailSentAt: new Date(), updatedAt: new Date() }).where(eq(bookings.id, bookingId));
    return keys;
  });
  await Promise.all(eventKeys.map((key) => deliverEmail(key)));
  return eventKeys.length > 0;
}
