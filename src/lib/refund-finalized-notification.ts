import { db } from "@/db";
import { bookings, emailOutbox, properties, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { templates } from "@/lib/mail";
import { deliverEmail } from "@/lib/email-outbox";

/**
 * T-273 (audit n°8, F3) — e-mail voyageur à la finalisation d'un
 * remboursement hors plateforme.
 *
 * Constat : `refundStatus` ne devenait `refunded` que par le webhook Stripe
 * (`payment-events.ts`) ; un paiement sur place remboursé manuellement par
 * l'hôte restait « à traiter par l'hébergeur » à vie — l'état comptable ne
 * convergait pas. La route `POST /api/bookings/[id]/refund` pose l'état ;
 * cet e-mail le confirme au voyageur.
 *
 * Conception (pattern house T-203) : appel **best-effort post-commit**
 * (l'acte comptable est déjà posé — un échec d'e-mail ne le remet pas en
 * cause), **idempotent** (`eventKey` `refund-finalized:<id>` +
 * `onConflictDoNothing`), localisé à la langue du voyageur. E-mail
 * transactionnel : pas d'interrupteur dédié (débat technique T-273/T-275 —
 * même nature que la confirmation de remboursement d'annulation T-266).
 */
export async function sendRefundFinalizedNotificationIfNeeded(bookingId: string): Promise<boolean> {
  const eventKeys = await db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update");
    // Garde d'état : seul un remboursement **finalisé** émet (ni `none`, ni
    // `pending` — la voie PSP garde son propre e-mail de refund).
    if (!booking || booking.refundStatus !== "refunded") return [];

    const [property] = await tx
      .select({ name: properties.name })
      .from(properties)
      .where(eq(properties.id, booking.propertyId))
      .limit(1);
    const [guest] = booking.userId
      ? await tx.select({ language: users.language }).from(users).where(eq(users.id, booking.userId)).limit(1)
      : [];

    const mail = templates.bookingRefundFinalized({
      firstName: booking.guestFirstName,
      bookingReference: booking.bookingReference,
      propertyName: property?.name ?? "",
      refundAmount: String(booking.refundAmount ?? booking.total),
      currency: booking.currency,
      language: guest?.language ?? null,
    });
    const key = `refund-finalized:${booking.id}`;
    await tx
      .insert(emailOutbox)
      .values({ eventKey: key, to: booking.guestEmail, ...mail })
      .onConflictDoNothing({ target: emailOutbox.eventKey });
    return [key];
  });

  await Promise.all(eventKeys.map((key) => deliverEmail(key)));
  return eventKeys.length > 0;
}
