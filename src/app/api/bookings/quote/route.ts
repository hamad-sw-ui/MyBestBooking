import { NextRequest, NextResponse } from "next/server";
import { expireRequestsInTransaction } from "@/lib/booking-request-expiration";
import { notifyExpiredRequest } from "@/lib/booking-request-notifications";
import { civilToday } from "@/lib/dates";
import { and, eq, gt, gte, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, properties, ratePlans, rooms, roomAvailability } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { evaluateBookingRules, stayNightsWithinLimit } from "@/lib/booking-rules";
import { apiError } from "@/lib/api-error";
import { zodErrorResponse } from "@/lib/http";
import { getSetting } from "@/lib/settings";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

const quoteSchema = z
  .object({
    propertyId: z.string().uuid(),
    roomId: z.string().uuid(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn doit être au format YYYY-MM-DD"),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut doit être au format YYYY-MM-DD"),
    numAdults: z.coerce.number().int().min(1),
    numChildren: z.coerce.number().int().min(0).default(0),
    ratePlanId: z.string().uuid().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    message: "La date de départ doit être postérieure à la date d'arrivée",
    path: ["checkOut"],
  });

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * GET /api/bookings/quote — devis non persistant du tunnel de réservation.
 *
 * T-205 : le récapitulatif client ne doit plus approximer le prix avec
 * `rooms.basePrice × nuits` quand le calendrier a des tarifs journaliers.
 * Cet endpoint lit les mêmes briques métier que POST /api/bookings
 * (disponibilité, stop-sell, min stay, chevauchements, rate plan, TVA et
 * BestRewards) sans créer de hold : le POST reste l'autorité finale.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    await assertNotMaintenance(user);

    const rl = rateLimit(user ? `bookingquote:user:${user.id}` : `bookingquote:ip:${ipFromRequest(request)}`, {
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: await apiError("Trop de tentatives, réessayez plus tard") },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const url = new URL(request.url);
    const data = quoteSchema.parse({
      propertyId: url.searchParams.get("propertyId"),
      roomId: url.searchParams.get("roomId"),
      checkIn: url.searchParams.get("checkIn"),
      checkOut: url.searchParams.get("checkOut"),
      numAdults: url.searchParams.get("numAdults"),
      numChildren: url.searchParams.get("numChildren") ?? undefined,
      ratePlanId: url.searchParams.get("ratePlanId") || undefined,
    });

    const today = civilToday();
    if (data.checkIn < today) {
      return NextResponse.json({ error: await apiError("La date d'arrivée ne peut pas être dans le passé") }, { status: 400 });
    }
    if (!stayNightsWithinLimit(data.checkIn, data.checkOut)) {
      return NextResponse.json({ error: await apiError("Un séjour doit compter entre 1 et 365 nuits") }, { status: 400 });
    }

    const [row] = await db
      .select({ property: properties, room: rooms })
      .from(rooms)
      .innerJoin(properties, eq(rooms.propertyId, properties.id))
      .where(and(
        eq(properties.id, data.propertyId),
        eq(rooms.id, data.roomId),
      ))
      .limit(1);

    if (!row || row.property.status !== "active" || !row.room.isActive) {
      return NextResponse.json({ error: await apiError("Chambre non disponible") }, { status: 400 });
    }

    // T-234 (audit n°3, F3) — un devis ne doit pas annoncer « indisponible »
    // à cause d'une demande **déjà expirée** dont le cron n'a pas encore purgé
    // le stock. On libère d'abord la fenêtre demandée (même règle que le
    // tunnel), puis on évalue.
    const expiredByQuote = await expireRequestsInTransaction(db as never, new Date(), {
      roomId: data.roomId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
    });
    for (const expired of expiredByQuote) {
      try {
        await notifyExpiredRequest(expired);
      } catch (mailError) {
        console.error("[quote] notification d'expiration impossible :", mailError);
      }
    }

    const [availability, overlaps, billing, bestrewardsSettings] = await Promise.all([
      db
        .select({
          date: roomAvailability.date,
          availableCount: roomAvailability.availableCount,
          price: roomAvailability.price,
          stopSell: roomAvailability.stopSell,
          minStay: roomAvailability.minStay,
        })
        .from(roomAvailability)
        .where(and(
          eq(roomAvailability.roomId, data.roomId),
          gte(roomAvailability.date, data.checkIn),
          lt(roomAvailability.date, data.checkOut),
        )),
      db
        .select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
        .from(bookings)
        .where(and(
          eq(bookings.roomId, data.roomId),
          ne(bookings.status, "cancelled"),
          lt(bookings.checkIn, data.checkOut),
          gt(bookings.checkOut, data.checkIn),
        )),
      getSetting("billing"),
      getSetting("bestrewards"),
    ]);

    const rules = evaluateBookingRules({
      room: {
        maxOccupancy: row.room.maxOccupancy,
        maxAdults: row.room.maxAdults,
        maxChildren: row.room.maxChildren,
        quantity: row.room.quantity ?? 1,
        basePrice: row.room.basePrice,
      },
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      numAdults: data.numAdults,
      numChildren: data.numChildren,
      availability,
      overlappingBookings: overlaps,
    });
    if (!rules.ok) {
      const status = rules.code && ["dates", "capacity", "min_stay", "bad_price"].includes(rules.code) ? 400 : 409;
      return NextResponse.json({ error: await apiError(rules.error ?? "Séjour indisponible") }, { status });
    }

    let selectedRatePlan: typeof ratePlans.$inferSelect | null = null;
    if (data.ratePlanId) {
      const [plan] = await db
        .select()
        .from(ratePlans)
        .where(and(eq(ratePlans.id, data.ratePlanId), eq(ratePlans.roomId, row.room.id), eq(ratePlans.isActive, true)))
        .limit(1);
      if (!plan) {
        return NextResponse.json({ error: await apiError("Plan tarifaire indisponible pour cette chambre") }, { status: 409 });
      }
      selectedRatePlan = plan;
    }

    const baseSubtotal = cents(rules.nightlyPrices.reduce((sum, price) => sum + price, 0));
    const ratePlanDiscount = selectedRatePlan
      ? cents(baseSubtotal * (Number(selectedRatePlan.discountPercentage ?? "0") / 100))
      : 0;
    const subtotal = cents(Math.max(0, baseSubtotal - ratePlanDiscount));
    const taxes = cents(subtotal * billing.taxRate);
    const totalBeforePromo = cents(subtotal + taxes);

    const level = user?.bestrewardsLevel ?? 1;
    let bestrewardsDiscountPercent = level >= 3
      ? bestrewardsSettings.discounts[2]
      : level >= 2
        ? bestrewardsSettings.discounts[1]
        : bestrewardsSettings.discounts[0];
    if (!user) bestrewardsDiscountPercent = 0;
    if (user && row.property.isBestrewards && level >= 2) {
      bestrewardsDiscountPercent = Math.min(30, bestrewardsDiscountPercent + 2);
    }
    const bestrewardsDiscount = bestrewardsDiscountPercent > 0
      ? cents(totalBeforePromo * (bestrewardsDiscountPercent / 100))
      : 0;

    return NextResponse.json({
      ok: true,
      currency: row.room.currency || "EUR",
      nights: rules.nights,
      nightlyPrices: rules.nightlyPrices.map(cents),
      baseSubtotal,
      ratePlanDiscount,
      subtotal,
      taxes,
      totalBeforePromo,
      bestrewardsDiscountPercent,
      bestrewardsDiscount,
      totalBeforeWallet: cents(Math.max(0, totalBeforePromo - bestrewardsDiscount)),
    });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("Error quoting booking:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
