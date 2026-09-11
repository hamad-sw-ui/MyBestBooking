import { db } from "@/db";
import { bookings, emailOutbox, properties, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { templates } from "@/lib/mail";
import { deliverEmail } from "@/lib/email-outbox";
import { getSetting } from "@/lib/settings";

/**
 * T-272 (audit n°8, F2) — e-mail voyageur au passage `no_show`.
 *
 * Constat d'exécution : la transition `→ no_show` (bouton hôte,
 * `PUT /api/bookings/[id]`) ne produisait aucun e-mail au voyageur — il
 * découvrait l'état terminal (et la perte de cashback) seul, sans modalité
 * (outbox vide, fixture MBB-T8-NOSHOW rejoué pendant l'audit).
 *
 * Conception (pattern house T-203, `sendBookingConfirmationIfNeeded`) :
 *  - appel **best-effort post-commit** : un échec d'e-mail ne remet jamais en
 *    cause la transition déjà committée ;
 *  - **idempotent** : `eventKey` déterministe `no-show:<bookingId>` +
 *    `onConflictDoNothing` — une 2e transition identique (impossible par la
 *    FSM, parachevé ici) ne duplique rien ;
 *  - e-mail **transactionnel** (état terminal à conséquences pécuniaires) :
 *    hors préférences utilisateur (T-261 — seules les catégories « confort »
 *    sont réglables), sous l'interrupteur admin global `bookingNoShow`
 *    (défaut `true`, `mergeDefaults` complète les payloads stockés).
 *  - localisé à la langue du voyageur ; jamais de lien de contestation
 *    automatique (le recours reste humain — décision d'audit n°8).
 */
export async function sendNoShowNotificationIfNeeded(bookingId: string): Promise<boolean> {
  const notifications = await getSetting("notifications");
  if (!notifications.bookingNoShow) return false;

  const eventKeys = await db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update");
    // Garde d'état : seul le no-show émet (ni confirmed, ni completed, ni
    // cancelled — l'e-mail d'annulation garde son périmètre T-150/T-266).
    if (!booking || booking.status !== "no_show") return [];

    const [property] = await tx
      .select({ name: properties.name })
      .from(properties)
      .where(eq(properties.id, booking.propertyId))
      .limit(1);
    // Langue du voyageur (destinataire) : l'e-mail est localisé pour lui.
    const [guest] = booking.userId
      ? await tx.select({ language: users.language }).from(users).where(eq(users.id, booking.userId)).limit(1)
      : [];

    const mail = templates.noShow({
      firstName: booking.guestFirstName,
      bookingReference: booking.bookingReference,
      propertyName: property?.name ?? "",
      checkIn: String(booking.checkIn),
      checkOut: String(booking.checkOut),
      language: guest?.language ?? null,
    });
    const key = `no-show:${booking.id}`;
    await tx
      .insert(emailOutbox)
      .values({ eventKey: key, to: booking.guestEmail, ...mail })
      .onConflictDoNothing({ target: emailOutbox.eventKey });
    return [key];
  });

  await Promise.all(eventKeys.map((key) => deliverEmail(key)));
  return eventKeys.length > 0;
}
