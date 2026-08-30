import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { sendBookingConfirmationIfNeeded } from "@/lib/booking-confirmation";
import { getPaymentProvider } from "@/lib/payment";

export type PaymentIntentSetup = {
  booking: typeof bookings.$inferSelect;
  provider: "mock" | "stripe" | "wallet";
  clientSecret: string | null;
  status: "succeeded" | "pending";
};

/**
 * Crée et rattache l’intent après le commit de réservation. La référence est
 * unique et sert de clé PSP stable : une reprise après timeout retrouve le
 * même intent au lieu de créer une seconde autorisation.
 */
export async function createPaymentIntentForBooking(bookingId: string): Promise<PaymentIntentSetup | null> {
  const [candidate] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!candidate || candidate.status !== "pending" || candidate.paymentStatus !== "pending" || candidate.paymentIntentId || !candidate.paymentExpiresAt || candidate.paymentExpiresAt <= new Date()) {
    return null;
  }

  // Aucun PSP ne doit recevoir un montant nul (Stripe le refuse). Les
  // crédits/promo qui couvrent tout confirment une réservation sans débit.
  if (Number(candidate.total) <= 0) {
    const [updated] = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
      if (!locked || locked.status !== "pending" || locked.paymentStatus !== "pending" || locked.paymentIntentId || !locked.paymentExpiresAt || locked.paymentExpiresAt <= new Date()) return [];
      return tx.update(bookings).set({
        status: "confirmed",
        paymentStatus: "paid",
        paymentMethod: "wallet",
        paymentExpiresAt: null,
        updatedAt: new Date(),
      }).where(eq(bookings.id, bookingId)).returning();
    });
    if (!updated) return null;
    await sendBookingConfirmationIfNeeded(updated.id).catch((error) => console.error("[payment-intents] confirmation failed:", error));
    return { booking: updated, provider: "wallet", clientSecret: null, status: "succeeded" };
  }

  const provider = await getPaymentProvider();
  const intent = await provider.create({
    amount: Math.round(Number(candidate.total) * 100),
    currency: (candidate.currency || "EUR").toUpperCase(),
    bookingReference: candidate.bookingReference,
    guestEmail: candidate.guestEmail,
    idempotencyKey: `booking-intent:${candidate.bookingReference}`,
  });

  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!locked || locked.status !== "pending" || locked.paymentStatus !== "pending" || locked.paymentIntentId || !locked.paymentExpiresAt || locked.paymentExpiresAt <= new Date()) {
      return { booking: null, stale: true };
    }
    const [updated] = await tx.update(bookings).set({
      paymentIntentId: intent.id,
      paymentMethod: provider.kind === "stripe" ? "stripe" : "mock_card",
      paymentStatus: intent.status === "succeeded" ? "paid" : "pending",
      status: intent.status === "succeeded" ? "confirmed" : "pending",
      paymentExpiresAt: intent.status === "succeeded" ? null : locked.paymentExpiresAt,
      updatedAt: new Date(),
    }).where(eq(bookings.id, bookingId)).returning();
    return { booking: updated, stale: false };
  });

  if (!result.booking) {
    // La réservation a été annulée/expirée pendant l’appel externe. Ne jamais
    // laisser un intent inutile, ni réactiver le séjour.
    if (intent.status === "succeeded") {
      await provider.refund(intent.id, intent.amount, `orphan-intent-refund:${candidate.bookingReference}`).catch(() => undefined);
    } else {
      await provider.cancel(intent.id).catch(() => "failed");
    }
    return null;
  }

  if (intent.status === "succeeded") {
    await sendBookingConfirmationIfNeeded(result.booking.id).catch((error) => {
      console.error("[payment-intents] confirmation failed:", error);
    });
  }
  return {
    booking: result.booking,
    provider: provider.kind,
    clientSecret: intent.clientSecret,
    status: intent.status === "succeeded" ? "succeeded" : "pending",
  };
}

/** Reprise bornée des bookings committés dont l’intent n’a pas été rattaché. */
export async function recoverPendingPaymentIntents(limit = 20): Promise<{ recovered: number; failed: number }> {
  const candidates = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.status, "pending"),
      eq(bookings.paymentStatus, "pending"),
      isNull(bookings.paymentIntentId),
      gt(bookings.paymentExpiresAt, new Date()),
    ))
    .limit(limit);
  let recovered = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      if (await createPaymentIntentForBooking(candidate.id)) recovered += 1;
    } catch (error) {
      failed += 1;
      console.error("[payment-intents] recovery failed:", error);
    }
  }
  return { recovered, failed };
}

/**
 * Reprend un checkout déjà créé sans générer une seconde réservation. Pour un
 * intent déjà rattaché, le provider redonne le client secret propriétaire; pour
 * un hold sans intent, la création garde la clé idempotente booking.
 */
export async function resumePaymentIntentForBooking(bookingId: string): Promise<PaymentIntentSetup | null> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking || booking.status !== "pending" || booking.paymentStatus !== "pending" || !booking.paymentExpiresAt || booking.paymentExpiresAt <= new Date()) return null;
  if (!booking.paymentIntentId) return createPaymentIntentForBooking(bookingId);

  const provider = await getPaymentProvider();
  const intent = await provider.retrieve(booking.paymentIntentId);
  if (!intent) return createPaymentIntentForBooking(bookingId);
  return {
    booking,
    provider: provider.kind,
    clientSecret: intent.clientSecret,
    status: intent.status === "succeeded" ? "succeeded" : "pending",
  };
}
