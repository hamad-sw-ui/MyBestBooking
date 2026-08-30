import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, priceAlerts, promotions, properties, uploadObjects, users } from "@/db/schema";
import { and, eq, isNull, lt, lte, sql } from "drizzle-orm";
import { deliverPendingEmails, enqueueEmail } from "@/lib/email-outbox";
import { shouldNotifyPriceAlert } from "@/lib/price-alert-rules";
import { quotePriceAlert } from "@/lib/price-alert-quote";
import { calculateLoyaltyAward } from "@/lib/loyalty";
import { getSetting } from "@/lib/settings";
import { calculateReferralReward } from "@/lib/referral";
import { getUploader } from "@/lib/storage";
import { getPaymentProvider } from "@/lib/payment";
import { recoverPendingPaymentIntents } from "@/lib/payment-intents";
import { processPendingPaymentEvents, reconcileLateCapturedPaymentRefunds } from "@/lib/payment-events";
import { sendBookingReminders, sendReviewRequests } from "@/lib/booking-lifecycle-emails";
import { templates } from "@/lib/mail";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Tâche idempotente : calcule le meilleur prix de base actuellement actif,
 * respecte la préférence utilisateur et ne renvoie pas deux fois le même prix.
 * La planification est déclarée dans vercel.json ; le handler reste appelable
 * avec CRON_SECRET par tout ordonnanceur compatible.
 */
async function completeEligibleBookings(today: string): Promise<number> {
  const candidates = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.status, "confirmed"),
      eq(bookings.paymentStatus, "paid"),
      lte(bookings.checkOut, today),
      isNull(bookings.loyaltyAwardedAt),
    ));
  const settings = await getSetting("bestrewards");
  const referralReward = calculateReferralReward(settings.referral);
  let completed = 0;

  for (const candidate of candidates) {
    const changed = await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, candidate.id)).for("update");
      if (!booking || booking.status !== "confirmed" || booking.paymentStatus !== "paid" || booking.loyaltyAwardedAt) return false;
      const [user] = await tx.select().from(users).where(eq(users.id, booking.userId)).for("update");
      if (!user) return false;
      // T-153 (audit n°25, C) : le wallet est libellé EUR — le cashback est
      // calculé sur le total CONVERTI en EUR (jamais 1:1 depuis la devise de
      // la chambre). `cashbackAmount` stocke le montant EUR crédité.
      const loyalty = calculateLoyaltyAward({
        bookingsCount: user.bestrewardsBookingsCount,
        level: user.bestrewardsLevel,
        walletBalance: user.walletBalance,
      }, Number(booking.total), settings.thresholds, booking.currency ?? "EUR");
      // T-125 (P2) : le wallet du filleul cumule cashback BestRewards +
      // éventuel bonus de parrainage (une seule fois, garde
      // referralRewardedAt). Le parrain est crédité dans la même transaction.
      let refereeBonus = 0;
      if (user.referredBy && !user.referralRewardedAt && referralReward.refereeCredit > 0) {
        refereeBonus = referralReward.refereeCredit;
      }
      const refereeWallet = (Number(loyalty.walletBalance) + refereeBonus).toFixed(2);
      await tx.update(users).set({
        bestrewardsBookingsCount: loyalty.bookingsCount,
        bestrewardsLevel: loyalty.level,
        walletBalance: refereeWallet,
        // Marque la récompense de parrainage comme versée (idempotence),
        // même si les montants sont nuls, pour ne pas re-tenter au prochain run.
        ...(user.referredBy && !user.referralRewardedAt ? { referralRewardedAt: new Date() } : {}),
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));

      // Crédit du parrain (verrou ligne pour éviter toute course avec un
      // autre filleul terminant son séjour au même instant).
      if (user.referredBy && !user.referralRewardedAt && referralReward.referrerCredit > 0) {
        const [referrer] = await tx.select().from(users).where(eq(users.id, user.referredBy)).for("update");
        if (referrer) {
          const referrerWallet = (Number(referrer.walletBalance ?? "0") + referralReward.referrerCredit).toFixed(2);
          await tx.update(users).set({
            walletBalance: referrerWallet,
            updatedAt: new Date(),
          }).where(eq(users.id, referrer.id));
        }
      }

      await tx.update(bookings).set({
        status: "completed",
        loyaltyAwardedAt: new Date(),
        cashbackAmount: loyalty.cashback.toFixed(2),
        updatedAt: new Date(),
      }).where(eq(bookings.id, booking.id));
      return true;
    });
    if (changed) completed += 1;
  }
  return completed;
}

async function expirePendingBookings(): Promise<number> {
  const now = new Date();
  const candidates = await db.select({ id: bookings.id, paymentIntentId: bookings.paymentIntentId }).from(bookings).where(and(eq(bookings.status, "pending"), eq(bookings.paymentStatus, "pending"), lte(bookings.paymentExpiresAt, now))).limit(100);
  let expired = 0;
  const provider = await getPaymentProvider();
  for (const candidate of candidates) {
    if (candidate.paymentIntentId) {
      const cancelled = await provider.cancel(candidate.paymentIntentId);
      if (cancelled === "failed") continue;
    }
    const changed = await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, candidate.id)).for("update");
      if (!booking || booking.status !== "pending" || booking.paymentStatus !== "pending" || !booking.paymentExpiresAt || booking.paymentExpiresAt > now) return false;
      if (booking.promotionId) await tx.update(promotions).set({ currentUses: sql`GREATEST(${promotions.currentUses} - 1, 0)` }).where(eq(promotions.id, booking.promotionId));
      const walletUsed = Number(booking.walletCreditsUsed ?? "0");
      if (walletUsed > 0) {
        const [user] = await tx.select().from(users).where(eq(users.id, booking.userId)).for("update");
        if (user) await tx.update(users).set({ walletBalance: (Number(user.walletBalance ?? "0") + walletUsed).toFixed(2), updatedAt: new Date() }).where(eq(users.id, user.id));
      }
      await tx.update(bookings).set({
        status: "cancelled",
        paymentStatus: "failed",
        cancelledAt: now,
        cancellationReason: "Paiement non finalisé dans le délai",
        benefitsReleasedAt: new Date(),
        updatedAt: now,
      }).where(eq(bookings.id, booking.id));
      return true;
    });
    if (changed) expired += 1;
  }
  return expired;
}

async function cleanupOrphanUploads(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orphaned = await db.select({ key: uploadObjects.key }).from(uploadObjects).where(and(isNull(uploadObjects.attachedAt), lt(uploadObjects.createdAt, cutoff))).limit(100);
  const uploader = await getUploader();
  let removed = 0;
  for (const item of orphaned) {
    if (await uploader.remove(item.key)) {
      await db.delete(uploadObjects).where(eq(uploadObjects.key, item.key));
      removed += 1;
    }
  }
  return removed;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const completedBookings = await completeEligibleBookings(new Date().toISOString().slice(0, 10));
    // T-149 : e-mails de cycle de vie (rappels J-3/J-1 et demande d'avis),
    // idempotents via des eventKeys déterministes.
    const bookingRemindersSent = await sendBookingReminders();
    const reviewRequestsSent = await sendReviewRequests();
    const emailDelivery = await deliverPendingEmails();
    // Reprise des bookings committés avant l’appel PSP : aucun lock room/user
    // n’est maintenu pendant l’I/O fournisseur.
    const paymentIntentRecovery = await recoverPendingPaymentIntents();
    const expiredPendingBookings = await expirePendingBookings();
    const processedPaymentEvents = await processPendingPaymentEvents();
    const latePaymentRefunds = await reconcileLateCapturedPaymentRefunds();
    const orphanUploadsRemoved = await cleanupOrphanUploads();
    const alerts = await db
      .select({ alert: priceAlerts, user: users, property: properties })
      .from(priceAlerts)
      .leftJoin(users, eq(priceAlerts.userId, users.id))
      .leftJoin(properties, eq(priceAlerts.propertyId, properties.id))
      .where(and(eq(priceAlerts.active, true), eq(users.priceAlertEnabled, true)));

    let notified = 0;
    for (const entry of alerts) {
      if (!entry.user || !entry.property || entry.property.status !== "active") continue;
      const quote = await quotePriceAlert({
        propertyId: entry.property.id,
        currency: entry.alert.currency,
        context: {
          checkIn: entry.alert.checkIn ?? undefined,
          checkOut: entry.alert.checkOut ?? undefined,
          numAdults: entry.alert.numAdults ?? undefined,
          numChildren: entry.alert.numChildren ?? undefined,
        },
      });
      if (!quote) continue;
      const price = quote.price;
      if (!shouldNotifyPriceAlert({
        currentPrice: price,
        maxPrice: Number(entry.alert.maxPrice),
        lastNotifiedPrice: entry.alert.lastNotifiedPrice,
      })) continue;

      const currency = quote.currency;
      const isEn = entry.user.language === "en";
      const offerLabel = quote.mode === "trip"
        ? (isEn ? "for your stay (excluding taxes and personal discounts)" : "pour votre séjour (hors taxes et réductions personnelles)")
        : (isEn ? "from (base price)" : "à partir de (prix de base)");
      const alertMail = await templates.priceAlert({
        firstName: entry.user.firstName,
        propertyName: entry.property.name,
        price: price.toFixed(2),
        currency,
        maxPrice: Number(entry.alert.maxPrice).toFixed(2),
        offerLabel,
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/hebergement/${entry.property.slug}`,
        language: entry.user.language ?? null,
      });
      await enqueueEmail({
        eventKey: `price-alert:${entry.alert.id}:${quote.mode}:${price.toFixed(2)}`,
        to: entry.user.email,
        ...alertMail,
      });
      await db
        .update(priceAlerts)
        .set({ lastNotifiedAt: new Date(), lastNotifiedPrice: price.toFixed(2) })
        .where(eq(priceAlerts.id, entry.alert.id));
      notified += 1;
    }

    const alertEmailDelivery = await deliverPendingEmails();
    return NextResponse.json({ ok: true, scanned: alerts.length, notified, completedBookings, bookingRemindersSent, reviewRequestsSent, emailDelivery, alertEmailDelivery, paymentIntentRecovery, expiredPendingBookings, processedPaymentEvents, latePaymentRefunds, orphanUploadsRemoved });
  } catch (error) {
    console.error("[cron price-alerts]", error);
    return NextResponse.json({ error: "Échec du traitement des alertes prix" }, { status: 500 });
  }
}
