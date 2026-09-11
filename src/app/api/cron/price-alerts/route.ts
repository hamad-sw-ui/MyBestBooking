import { NextRequest, NextResponse } from "next/server";
import { civilToday } from "@/lib/dates";
import { db } from "@/db";
import { bookings, emailOutbox, priceAlerts, promotions, properties, uploadObjects, users } from "@/db/schema";
import { and, eq, gte, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { deliverPendingEmails, enqueueEmail } from "@/lib/email-outbox";
import { shouldNotifyPriceAlert, isStayExpired } from "@/lib/price-alert-rules";
import { appBaseUrl } from "@/lib/app-url";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { quotePriceAlert } from "@/lib/price-alert-quote";
import { calculateLoyaltyAward } from "@/lib/loyalty";
import { getSetting } from "@/lib/settings";
import { purgeTechnicalData } from "@/lib/technical-retention";
import { calculateReferralReward } from "@/lib/referral";
import { recordWalletEntry } from "@/lib/wallet-ledger";
import { getUploader } from "@/lib/storage";
import { getPaymentProvider } from "@/lib/payment";
import { recoverPendingPaymentIntents } from "@/lib/payment-intents";
import { processPendingPaymentEvents, reconcileLateCapturedPaymentRefunds } from "@/lib/payment-events";
import { sendBookingReminders, sendReviewRequests } from "@/lib/booking-lifecycle-emails";
import { expireManualBookingRequests as expireRequestsNow } from "@/lib/booking-request-expiration";
import { notifyExpiredRequest } from "@/lib/booking-request-notifications";
import { templates } from "@/lib/mail";
import { apiError } from "@/lib/api-error";
// T-250 (audit n°5, A7) : chaque exécution laisse une trace `cron_runs`.
import { runWithTrace } from "@/lib/cron-trace";

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
    .select({
      id: bookings.id,
      bookingReference: bookings.bookingReference,
      guestEmail: bookings.guestEmail,
      guestFirstName: bookings.guestFirstName,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      propertyId: bookings.propertyId,
    })
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
      // T-248 (audit n°5, A6) : chaque mouvement du wallet est journalisé dans
      // la transaction du solde — cashback puis bonus de parrainage, chacun
      // avec son propre `balance_after` (la somme des lignes = le solde).
      if (loyalty.cashback > 0) {
        await recordWalletEntry(tx, {
          userId: user.id,
          amount: loyalty.cashback,
          balanceAfter: (Number(user.walletBalance ?? "0") + loyalty.cashback).toFixed(2),
          kind: "cashback",
          bookingId: booking.id,
          note: booking.bookingReference ?? null,
        });
      }
      if (refereeBonus > 0) {
        await recordWalletEntry(tx, {
          userId: user.id,
          amount: refereeBonus,
          balanceAfter: refereeWallet,
          kind: "referral_referee",
          bookingId: booking.id,
        });
      }
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
          await recordWalletEntry(tx, {
            userId: referrer.id,
            amount: referralReward.referrerCredit,
            balanceAfter: referrerWallet,
            kind: "referral_referrer",
            bookingId: booking.id,
          });
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
  // T-203 : seule une réservation avec un intent de paiement réel (hold)
  // peut être annulée à l'expiration. Une demande manuelle (sans intent,
  // `paymentIntentId` NULL) reste `pending` jusqu'à décision de l'hôte —
  // sinon le cron annulerait la demande 15 min après sa création (bug T-202).
  const candidates = await db.select({ id: bookings.id, paymentIntentId: bookings.paymentIntentId }).from(bookings).where(and(eq(bookings.status, "pending"), eq(bookings.paymentStatus, "pending"), isNotNull(bookings.paymentIntentId), lte(bookings.paymentExpiresAt, now))).limit(100);
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
        if (user) {
          const balanceAfter = (Number(user.walletBalance ?? "0") + walletUsed).toFixed(2);
          await tx.update(users).set({ walletBalance: balanceAfter, updatedAt: new Date() }).where(eq(users.id, user.id));
          await recordWalletEntry(tx, {
            userId: user.id,
            amount: walletUsed,
            balanceAfter,
            kind: "booking_refund",
            bookingId: booking.id,
            note: booking.bookingReference ?? null,
          });
        }
      }
      await tx.update(bookings).set({
        status: "cancelled",
        paymentStatus: "failed",
        cancelledAt: now,
        cancellationReason: "Paiement non finalisé dans le délai",
        benefitsReleasedAt: new Date(),
        requestExpiresAt: null,
        updatedAt: now,
      }).where(eq(bookings.id, booking.id));
      return true;
    });
    if (changed) expired += 1;
  }
  return expired;
}

export async function sendPaymentReminders(now = new Date()): Promise<number> {
  const notifications = await getSetting("notifications");
  if (!notifications.bookingPaymentReminder) return 0;
  const todayIso = civilToday("UTC", now);
  const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: bookings.id,
      bookingReference: bookings.bookingReference,
      guestFirstName: bookings.guestFirstName,
      guestLastName: bookings.guestLastName,
      checkOut: bookings.checkOut,
      total: bookings.total,
      currency: bookings.currency,
      propertyName: properties.name,
      hostEmail: users.email,
      hostFirstName: users.firstName,
      hostLanguage: users.language,
    })
    .from(bookings)
    .innerJoin(properties, eq(bookings.propertyId, properties.id))
    .innerJoin(users, eq(properties.hostId, users.id))
    .where(and(
      eq(bookings.status, "confirmed"),
      lte(bookings.checkOut, todayIso),
      gte(bookings.checkOut, windowStart),
      isNull(bookings.paymentMethodOffline),
      sql`${bookings.paymentStatus} IS DISTINCT FROM 'paid'`,
      sql`NOT EXISTS (
        SELECT 1 FROM ${emailOutbox} o
        WHERE o.event_key = 'booking-payment-reminder:' || ${bookings.id}::text
      )`,
    ))
    .limit(50);

  let sent = 0;
  for (const row of rows) {
    const mail = await templates.bookingPaymentReminder({
      hostFirstName: row.hostFirstName,
      bookingReference: row.bookingReference,
      propertyName: row.propertyName,
      guestName: `${row.guestFirstName} ${row.guestLastName}`.trim(),
      checkOut: String(row.checkOut).slice(0, 10),
      total: String(row.total ?? "0"),
      currency: row.currency ?? "EUR",
      language: row.hostLanguage ?? null,
    });
    await enqueueEmail({
      eventKey: `booking-payment-reminder:${row.id}`,
      to: row.hostEmail,
      ...mail,
    });
    sent += 1;
  }
  return sent;
}

/**
 * T-209/F1 + T-234 : purge des demandes expirées.
 *
 * La logique vit désormais dans `src/lib/booking-request-expiration.ts` afin
 * d'être appelable **dans** la transaction du tunnel de réservation (le cron
 * quotidien ne suffisait pas : une demande expirée bloquait les dates jusqu'au
 * passage suivant). Ici, on ne fait que brancher la notification post-commit.
 * Réexport conservé pour les tests d'intégration existants.
 */
export const expireManualBookingRequests = (now = new Date()) =>
  expireRequestsNow(now, notifyExpiredRequest);

/** T-161 (audit n°30) — désactive les alertes « séjour » dont le départ est
 *  déjà passé (elles ne peuvent plus jamais se réaliser ; re-quotées
 *  inutilement à chaque run sinon). Conservateur : active=false, jamais de
 *  suppression — l'historique et le seuil sont conservés. Exporté pour le
 *  test d'intégration (additif). */
export async function expirePastStayAlerts(today: string): Promise<number> {
  const updated = await db
    .update(priceAlerts)
    .set({ active: false })
    .where(and(eq(priceAlerts.active, true), lt(priceAlerts.checkOut, today)))
    .returning({ id: priceAlerts.id });
  return updated.length;
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

/**
 * T-274 (audit n°8, F4) — périmètre scanné du cron d'alertes prix : alertes
 * **actives** de comptes **opt-in** **vivants**.
 *
 * La garde `isNull(users.deletedAt)` est une défense en profondeur :
 * l'anonymisation (T-274, `anonymizeUserAccount`) désactive désormais les
 * alertes et le flag à la suppression de compte ; cette garde protège les
 * comptes supprimés **avant** le correctif et tout futur chemin de
 * suppression qui oublierait l'anonymisation. Sans elle, une alerte active
 * d'un compte mort était notifiée perpétuellement vers l'adresse anonymisée
 * (prouvé runtime pendant l'audit : e-mail « sent » vers
 * `deleted-…@anonymized.local`).
 */
export async function selectActivePriceAlerts() {
  return db
    .select({ alert: priceAlerts, user: users, property: properties })
    .from(priceAlerts)
    .leftJoin(users, eq(priceAlerts.userId, users.id))
    .leftJoin(properties, eq(priceAlerts.propertyId, properties.id))
    .where(
      and(
        eq(priceAlerts.active, true),
        eq(users.priceAlertEnabled, true),
        isNull(users.deletedAt),
      ),
    );
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });

  try {
    // T-250 : la tâche est exécutée puis tracée (une ligne par exécution,
    // succès comme échec). Le corps de la réponse reste identique.
    const { value: payload } = await runWithTrace(
      "price-alerts",
      () => runPriceAlertsJob(),
      (result) => ({
        scanned: result.scanned,
        notified: result.notified,
        pastAlertsExpired: result.pastAlertsExpired,
        completedBookings: result.completedBookings,
        bookingRemindersSent: result.bookingRemindersSent,
        reviewRequestsSent: result.reviewRequestsSent,
        expiredPendingBookings: result.expiredPendingBookings,
        expiredManualBookingRequests: result.expiredManualBookingRequests,
      }),
    );
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error("[cron price-alerts]", error);
    return NextResponse.json({ error: await apiError("Échec du traitement des alertes prix") }, { status: 500 });
  }
}

/**
 * Corps de la tâche planifiée (inchangé depuis T-243) : la fonction retourne
 * les compteurs au lieu de construire la réponse, afin que T-250 puisse les
 * journaliser.
 */
async function runPriceAlertsJob() {
  {
    const today = civilToday();
    const completedBookings = await completeEligibleBookings(today);
    // T-149 : e-mails de cycle de vie (rappels J-3/J-1 et demande d'avis),
    // idempotents via des eventKeys déterministes.
    const bookingRemindersSent = await sendBookingReminders();
    const reviewRequestsSent = await sendReviewRequests();
    const emailDelivery = await deliverPendingEmails();
    // Reprise des bookings committés avant l’appel PSP : aucun lock room/user
    // n’est maintenu pendant l’I/O fournisseur.
    const paymentIntentRecovery = await recoverPendingPaymentIntents();
    const expiredPendingBookings = await expirePendingBookings();
    const expiredManualBookingRequests = await expireManualBookingRequests();
    const paymentRemindersSent = await sendPaymentReminders();
    const processedPaymentEvents = await processPendingPaymentEvents();
    const latePaymentRefunds = await reconcileLateCapturedPaymentRefunds();
    const orphanUploadsRemoved = await cleanupOrphanUploads();
    // T-243 (audit n°4) : rétention des données techniques (sessions expirées,
    // e-mails terminaux) — aucune donnée métier touchée.
    const technicalPurge = await purgeTechnicalData();
    // T-161 : avant de quoter, on retire du périmètre les alertes expirées.
    const pastAlertsExpired = await expirePastStayAlerts(today);
    // T-223 (A3) : l'interrupteur global `notifications.priceAlerts` était
    // stocké mais jamais appliqué (seuls les opt-in individuels `active` /
    // `priceAlertEnabled` l'étaient). Défaut `true` : comportement inchangé
    // tant qu'un admin ne coupe pas explicitement la fonctionnalité.
    const notifications = await getSetting("notifications");
    const alerts = notifications.priceAlerts ? await selectActivePriceAlerts() : [];

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
        url: `${appBaseUrl()}/hebergement/${entry.property.slug}`,
        // T-239 : l'alerte prix est le seul envoi non transactionnel ; elle
        // doit porter un moyen d'opposition en un clic (jeton signé).
        unsubscribeUrl: unsubscribeUrl(entry.user.id, "price_alerts"),
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
    return {
      priceAlertsEnabled: notifications.priceAlerts,
      scanned: alerts.length,
      notified,
      pastAlertsExpired,
      completedBookings,
      bookingRemindersSent,
      reviewRequestsSent,
      emailDelivery,
      alertEmailDelivery,
      paymentIntentRecovery,
      expiredPendingBookings,
      expiredManualBookingRequests,
      paymentRemindersSent,
      processedPaymentEvents,
      latePaymentRefunds,
      orphanUploadsRemoved,
      technicalPurge,
    };
  }
}
