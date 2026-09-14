import { db } from "@/db";
import { bookings, emailOutbox, properties, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { templates } from "@/lib/mail";
import { deliverEmail } from "@/lib/email-outbox";
import { getSetting } from "@/lib/settings";

/**
 * Notification transactionnelle du passage `confirmed` → `completed`.
 *
 * Le changement de statut est déjà persisté par la route dashboard. Cette
 * fonction est appelée post-commit, crée une seule entrée outbox déterministe
 * et ne peut donc pas annuler ni ralentir la transition métier en cas de panne
 * du provider email. La demande d'avis du cron reste un événement séparé.
 */
export async function sendBookingCompletedNotificationIfNeeded(bookingId: string): Promise<boolean> {
  const notifications = await getSetting("notifications");
  if (!notifications.bookingCompleted) return false;

  const eventKeys = await db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update");
    if (!booking || booking.status !== "completed") return [];

    const [property] = await tx
      .select({ name: properties.name })
      .from(properties)
      .where(eq(properties.id, booking.propertyId))
      .limit(1);
    const [guest] = booking.userId
      ? await tx
          .select({ language: users.language })
          .from(users)
          .where(eq(users.id, booking.userId))
          .limit(1)
      : [];

    const mail = templates.bookingCompleted({
      firstName: booking.guestFirstName,
      bookingReference: booking.bookingReference,
      propertyName: property?.name ?? "",
      checkIn: String(booking.checkIn),
      checkOut: String(booking.checkOut),
      language: guest?.language ?? null,
    });
    const eventKey = `booking-completed:${booking.id}`;
    const inserted = await tx
      .insert(emailOutbox)
      .values({ eventKey, to: booking.guestEmail, ...mail })
      .onConflictDoNothing({ target: emailOutbox.eventKey })
      .returning({ id: emailOutbox.id });
    return inserted.length > 0 ? [eventKey] : [];
  });

  await Promise.all(eventKeys.map((key) => deliverEmail(key)));
  return eventKeys.length > 0;
}
