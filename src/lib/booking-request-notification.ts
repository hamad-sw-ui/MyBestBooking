import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, emailOutbox, properties, rooms, users } from "@/db/schema";
import { deliverEmail } from "@/lib/email-outbox";
import { templates } from "@/lib/mail";

/**
 * T-209/F2 — notification immédiate d'une DEMANDE de réservation.
 *
 * Distincte de `sendBookingConfirmationIfNeeded` : ici la réservation est
 * encore `pending` et aucun paiement n'est demandé sur la plateforme. Les deux
 * destinataires ont des eventKeys séparées pour préserver l'idempotence.
 */
export async function sendBookingRequestCreatedIfNeeded(bookingId: string): Promise<boolean> {
  const eventKeys = await db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update");
    if (!booking || booking.status !== "pending") return [];

    const [property] = await tx
      .select({ id: properties.id, name: properties.name, city: properties.city, hostId: properties.hostId })
      .from(properties)
      .where(eq(properties.id, booking.propertyId))
      .limit(1);
    const [room] = await tx
      .select({ name: rooms.name })
      .from(rooms)
      .where(eq(rooms.id, booking.roomId))
      .limit(1);
    const [traveler] = await tx
      .select({ language: users.language })
      .from(users)
      .where(eq(users.id, booking.userId))
      .limit(1);

    const propertyName = property?.name ?? room?.name ?? "";
    const travelerMail = templates.bookingRequestTraveler({
      firstName: booking.guestFirstName,
      bookingReference: booking.bookingReference,
      propertyName,
      city: property?.city ?? "",
      checkIn: String(booking.checkIn),
      checkOut: String(booking.checkOut),
      total: String(booking.total),
      currency: booking.currency,
      requestExpiresAt: booking.requestExpiresAt,
      estimatedArrival: booking.estimatedArrival,
      language: traveler?.language ?? null,
    });
    const travelerKey = `booking-request:${booking.id}:traveler`;
    await tx
      .insert(emailOutbox)
      .values({ eventKey: travelerKey, to: booking.guestEmail, ...travelerMail })
      .onConflictDoNothing({ target: emailOutbox.eventKey });
    const keys = [travelerKey];

    if (property?.hostId) {
      const [host] = await tx
        .select({ email: users.email, firstName: users.firstName, language: users.language })
        .from(users)
        .where(eq(users.id, property.hostId))
        .limit(1);
      if (host?.email) {
        const hostMail = templates.bookingRequestHost({
          hostFirstName: host.firstName,
          bookingReference: booking.bookingReference,
          propertyName,
          guestName: `${booking.guestFirstName} ${booking.guestLastName}`.trim(),
          checkIn: String(booking.checkIn),
          checkOut: String(booking.checkOut),
          requestExpiresAt: booking.requestExpiresAt,
          estimatedArrival: booking.estimatedArrival,
          language: host.language ?? null,
        });
        const hostKey = `booking-request:${booking.id}:host`;
        await tx
          .insert(emailOutbox)
          .values({ eventKey: hostKey, to: host.email, ...hostMail })
          .onConflictDoNothing({ target: emailOutbox.eventKey });
        keys.push(hostKey);
      }
    }

    return keys;
  });

  await Promise.all(eventKeys.map((key) => deliverEmail(key)));
  return eventKeys.length > 0;
}
