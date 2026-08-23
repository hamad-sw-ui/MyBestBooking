import { db } from "@/db";
import { bookings, properties, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getMailer, templates } from "@/lib/mail";

/**
 * Envoie les confirmations après une capture réelle/mock réussie. Le verrou
 * booking évite les doublons lors des retries webhook normaux.
 */
export async function sendBookingConfirmationIfNeeded(bookingId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    // PostgreSQL ne permet pas FOR UPDATE sur le côté nullable d'un LEFT JOIN.
    // Verrouiller la réservation seule puis charger la property séparément.
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update");
    if (!booking || booking.status !== "confirmed" || booking.paymentStatus !== "paid" || booking.confirmationEmailSentAt) {
      return false;
    }
    const [property] = await tx.select().from(properties).where(eq(properties.id, booking.propertyId));

    const mailer = await getMailer();
    const travellerMail = await templates.bookingConfirmation({
      firstName: booking.guestFirstName,
      bookingReference: booking.bookingReference,
      propertyName: property?.name ?? "",
      city: property?.city ?? "",
      checkIn: String(booking.checkIn),
      checkOut: String(booking.checkOut),
      total: String(booking.total),
      currency: booking.currency,
    });
    await mailer.send({ to: booking.guestEmail, ...travellerMail });

    if (property?.hostId) {
      const [host] = await tx
        .select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, property.hostId));
      if (host) {
        const hostMail = await templates.bookingHostNotification({
          hostFirstName: host.firstName,
          bookingReference: booking.bookingReference,
          propertyName: property.name,
          guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
          checkIn: String(booking.checkIn),
          checkOut: String(booking.checkOut),
        });
        await mailer.send({ to: host.email, ...hostMail });
      }
    }

    await tx
      .update(bookings)
      .set({ confirmationEmailSentAt: new Date(), updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));
    return true;
  });
}
