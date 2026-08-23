import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, priceAlerts, promotions, properties, rooms, uploadObjects, users } from "@/db/schema";
import { and, eq, isNull, lt, lte, sql } from "drizzle-orm";
import { deliverPendingEmails, enqueueEmail } from "@/lib/email-outbox";
import { shouldNotifyPriceAlert } from "@/lib/price-alert-rules";
import { calculateLoyaltyAward } from "@/lib/loyalty";
import { getSetting } from "@/lib/settings";
import { getUploader } from "@/lib/storage";
import { getPaymentProvider } from "@/lib/payment";
import { processPendingPaymentEvents } from "@/lib/payment-events";

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
  let completed = 0;

  for (const candidate of candidates) {
    const changed = await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, candidate.id)).for("update");
      if (!booking || booking.status !== "confirmed" || booking.paymentStatus !== "paid" || booking.loyaltyAwardedAt) return false;
      const [user] = await tx.select().from(users).where(eq(users.id, booking.userId)).for("update");
      if (!user) return false;
      const loyalty = calculateLoyaltyAward({
        bookingsCount: user.bestrewardsBookingsCount,
        level: user.bestrewardsLevel,
        walletBalance: user.walletBalance,
      }, Number(booking.total), settings.thresholds);
      await tx.update(users).set({
        bestrewardsBookingsCount: loyalty.bookingsCount,
        bestrewardsLevel: loyalty.level,
        walletBalance: loyalty.walletBalance,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
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
      await tx.update(bookings).set({ status: "cancelled", paymentStatus: "failed", cancelledAt: now, cancellationReason: "Paiement non finalisé dans le délai", updatedAt: now }).where(eq(bookings.id, booking.id));
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
    const emailDelivery = await deliverPendingEmails();
    const expiredPendingBookings = await expirePendingBookings();
    const processedPaymentEvents = await processPendingPaymentEvents();
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
      const activeRooms = await db
        .select({ basePrice: rooms.basePrice, currency: rooms.currency })
        .from(rooms)
        .where(and(eq(rooms.propertyId, entry.property.id), eq(rooms.isActive, true)));
      const candidates = activeRooms.map((room) => Number(room.basePrice)).filter(Number.isFinite);
      if (!candidates.length) continue;
      const price = Math.min(...candidates);
      if (!shouldNotifyPriceAlert({
        currentPrice: price,
        maxPrice: Number(entry.alert.maxPrice),
        lastNotifiedPrice: entry.alert.lastNotifiedPrice,
      })) continue;

      const currency = entry.alert.currency ?? activeRooms[0]?.currency ?? "EUR";
      await enqueueEmail({
        eventKey: `price-alert:${entry.alert.id}:${price.toFixed(2)}`,
        to: entry.user.email,
        subject: `Alerte prix : ${entry.property.name}`,
        text: `Bonjour ${entry.user.firstName},\n\n${entry.property.name} est maintenant proposé à partir de ${price.toFixed(2)} ${currency}, sous votre seuil de ${Number(entry.alert.maxPrice).toFixed(2)} ${currency}.\n\nConnectez-vous à MyBestBooking pour consulter l'offre.`,
        html: `<p>Bonjour ${entry.user.firstName},</p><p><strong>${entry.property.name}</strong> est maintenant proposé à partir de <strong>${price.toFixed(2)} ${currency}</strong>, sous votre seuil de ${Number(entry.alert.maxPrice).toFixed(2)} ${currency}.</p><p>Connectez-vous à MyBestBooking pour consulter l'offre.</p>`,
      });
      await db
        .update(priceAlerts)
        .set({ lastNotifiedAt: new Date(), lastNotifiedPrice: price.toFixed(2) })
        .where(eq(priceAlerts.id, entry.alert.id));
      notified += 1;
    }

    const alertEmailDelivery = await deliverPendingEmails();
    return NextResponse.json({ ok: true, scanned: alerts.length, notified, completedBookings, emailDelivery, alertEmailDelivery, expiredPendingBookings, processedPaymentEvents, orphanUploadsRemoved });
  } catch (error) {
    console.error("[cron price-alerts]", error);
    return NextResponse.json({ error: "Échec du traitement des alertes prix" }, { status: 500 });
  }
}
