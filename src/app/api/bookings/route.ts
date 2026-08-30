import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties, promotions, ratePlans, rooms, roomAvailability, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateBookingReference } from "@/lib/utils";
import { eq, and, or, desc, lt, gt, gte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { applyPromoToTotal, isPromoUsable } from "@/lib/promotions";
import { getSetting } from "@/lib/settings";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";
import { frenchZodMessage } from "@/lib/http";
import { evaluateBookingRules, stayNightsWithinLimit } from "@/lib/booking-rules";
import { createPaymentIntentForBooking } from "@/lib/payment-intents";
import { issueToken } from "@/lib/tokens";
import { templates } from "@/lib/mail";
import { deliverEmail, enqueueEmail } from "@/lib/email-outbox";

const bookingSchema = z
  .object({
    propertyId: z.string().uuid(),
    roomId: z.string().uuid(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn doit être au format YYYY-MM-DD"),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut doit être au format YYYY-MM-DD"),
    numAdults: z.number().int().min(1),
    numChildren: z.number().int().min(0).optional(),
    guestFirstName: z.string().min(2),
    guestLastName: z.string().min(2),
    guestEmail: z.string().email(),
    guestPhone: z.string().optional(),
    guestCountry: z.string().length(2).optional(),
    // T-151 : langue du visiteur (checkout invité) → persistée sur le
    // profil invité pour localiser l'e-mail de réclamation de compte.
    language: z.enum(["fr", "en", "ar"]).optional(),
    tripPurpose: z.enum(["leisure", "business"]).optional(),
    specialRequests: z.string().optional(),
    estimatedArrival: z.string().optional(),
    promoCode: z.string().max(50).optional(),
    ratePlanId: z.string().uuid().optional(),
    useWalletCredits: z.boolean().optional(),
    // Réservation sans compte : l'API reste l'autorité, jamais le proxy.
    isGuestBooking: z.boolean().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    message: "La date de départ doit être postérieure à la date d'arrivée",
    path: ["checkOut"],
  });

class BookingRuleError extends Error {}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const propertyId = searchParams.get("propertyId");
    const conditions = [];

    if (user.role === "customer") {
      conditions.push(eq(bookings.userId, user.id));
    } else if (user.role === "host") {
      const hostProperties = await db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.hostId, user.id));
      const propertyIds = hostProperties.map((p) => p.id);
      if (!propertyIds.length) return NextResponse.json({ bookings: [] });
      conditions.push(or(...propertyIds.map((id) => eq(bookings.propertyId, id)))!);
    }
    if (status) conditions.push(eq(bookings.status, status));
    if (propertyId) conditions.push(eq(bookings.propertyId, propertyId));

    const results = await db
      .select({
        booking: bookings,
        property: {
          id: properties.id,
          name: properties.name,
          city: properties.city,
          country: properties.country,
          mainImage: properties.mainImage,
        },
        room: { id: rooms.id, name: rooms.name, roomType: rooms.roomType },
        user: { id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email },
      })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(bookings.createdAt));

    return NextResponse.json({ bookings: results });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const data = bookingSchema.parse(await request.json());
    const isGuestBooking = !user && data.isGuestBooking === true;

    if (!user && !isGuestBooking) {
      return NextResponse.json({ error: "Veuillez vous connecter pour réserver" }, { status: 401 });
    }

    await assertNotMaintenance(user);
    const today = new Date().toISOString().slice(0, 10);
    if (data.checkIn < today) return NextResponse.json({ error: "La date d'arrivée ne peut pas être dans le passé" }, { status: 400 });
    if (!stayNightsWithinLimit(data.checkIn, data.checkOut)) return NextResponse.json({ error: "Un séjour doit compter entre 1 et 365 nuits" }, { status: 400 });

    // Un invité n’a pas encore de userId : limiter par IP avant toute écriture.
    const rl = user
      ? rateLimit(`bookings:user:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 })
      : rateLimit(`bookings:guest-ip:${ipFromRequest(request)}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

    const [property] = await db.select().from(properties).where(eq(properties.id, data.propertyId));
    if (!property || property.status !== "active") return NextResponse.json({ error: "Hébergement non disponible" }, { status: 400 });
    const [room] = await db.select().from(rooms).where(and(eq(rooms.id, data.roomId), eq(rooms.propertyId, data.propertyId)));
    if (!room || !room.isActive) return NextResponse.json({ error: "Chambre non disponible" }, { status: 400 });

    if (isGuestBooking) {
      const [existing] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, data.guestEmail.toLowerCase())).limit(1);
      if (existing) {
        return NextResponse.json({
          error: existing.passwordHash
            ? "Connectez-vous pour réserver avec cet email"
            : "Activez d'abord votre accès depuis l'email de confirmation, puis connectez-vous",
        }, { status: 409 });
      }
    }

    const [billing, bestrewardsSettings] = await Promise.all([
      getSetting("billing"),
      getSetting("bestrewards"),
    ]);

    const bookingReference = generateBookingReference();
    let createdBooking: typeof bookings.$inferSelect;

    try {
      createdBooking = await db.transaction(async (tx) => {
        // Sérialise les réservations concurrentes sur une même chambre.
        await tx
          .select({ id: rooms.id })
          .from(rooms)
          .where(eq(rooms.id, data.roomId))
          .for("update");

        let lockedUser: typeof users.$inferSelect | null = null;
        if (user) {
          const [locked] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
          if (!locked) throw new BookingRuleError("Compte introuvable");
          lockedUser = locked;
        }

        const availability = await tx
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
          ));

        const overlaps = await tx
          .select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
          .from(bookings)
          .where(and(
            eq(bookings.roomId, data.roomId),
            ne(bookings.status, "cancelled"),
            lt(bookings.checkIn, data.checkOut),
            gt(bookings.checkOut, data.checkIn),
          ))
          .for("update");

        const rules = evaluateBookingRules({
          room: {
            maxOccupancy: room.maxOccupancy,
            maxAdults: room.maxAdults,
            maxChildren: room.maxChildren,
            quantity: room.quantity ?? 1,
            basePrice: room.basePrice,
          },
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          numAdults: data.numAdults,
          numChildren: data.numChildren ?? 0,
          availability,
          overlappingBookings: overlaps,
        });
        if (!rules.ok) throw new BookingRuleError(rules.error);

        let selectedRatePlan: typeof ratePlans.$inferSelect | null = null;
        if (data.ratePlanId) {
          const [plan] = await tx
            .select()
            .from(ratePlans)
            .where(and(eq(ratePlans.id, data.ratePlanId), eq(ratePlans.roomId, room.id), eq(ratePlans.isActive, true)))
            .limit(1);
          if (!plan) throw new BookingRuleError("Plan tarifaire indisponible pour cette chambre");
          selectedRatePlan = plan;
        }
        const baseSubtotal = rules.nightlyPrices.reduce((sum, price) => sum + price, 0);
        const ratePlanDiscount = selectedRatePlan
          ? Math.round(baseSubtotal * (Number(selectedRatePlan.discountPercentage ?? "0") / 100) * 100) / 100
          : 0;
        const subtotal = Math.max(0, baseSubtotal - ratePlanDiscount);
        const taxes = subtotal * billing.taxRate;
        let discount = ratePlanDiscount;
        let appliedPromoId: string | null = null;
        let total = subtotal + taxes;

        if (data.promoCode) {
          const [promo] = await tx
            .select()
            .from(promotions)
            .where(eq(promotions.code, data.promoCode.toUpperCase()))
            .limit(1);
          if (!promo) throw new BookingRuleError("Code promo : Code promo inconnu");
          const usable = isPromoUsable(promo);
          if (usable !== true) throw new BookingRuleError(`Code promo : ${usable}`);
          const result = applyPromoToTotal(promo, total);
          if ("error" in result) throw new BookingRuleError(`Code promo : ${result.error}`);
          discount = result.discount;
          total = result.finalTotal;
          appliedPromoId = promo.id;
        }

        const level = lockedUser?.bestrewardsLevel ?? 1;
        let bestrewardsPercent = level >= 3
          ? bestrewardsSettings.discounts[2]
          : level >= 2
            ? bestrewardsSettings.discounts[1]
            : bestrewardsSettings.discounts[0];
        if (property.isBestrewards && level >= 2) bestrewardsPercent = Math.min(30, bestrewardsPercent + 2);
        if (bestrewardsPercent > 0) {
          const benefit = Math.round(total * (bestrewardsPercent / 100) * 100) / 100;
          discount += benefit;
          total = Math.max(0, total - benefit);
        }

        let walletUsed = 0;
        if (data.useWalletCredits && lockedUser) {
          const wallet = Number(lockedUser.walletBalance ?? "0");
          if (wallet > 0) {
            walletUsed = Math.min(wallet, total);
            total = Math.max(0, total - walletUsed);
            discount += walletUsed;
          }
        }

        // Le profil invité n’est créé qu’après toutes les validations métier
        // (stock, promo, taux, wallet). Une demande rejetée n’écrit aucun user.
        if (!lockedUser) {
          const [createdGuest] = await tx.insert(users).values({
            email: data.guestEmail.toLowerCase(),
            firstName: data.guestFirstName,
            lastName: data.guestLastName,
            phone: data.guestPhone ?? null,
            country: data.guestCountry ?? null,
            role: "customer",
            emailVerified: false,
            passwordHash: null,
            language: data.language ?? "fr",
          }).returning();
          lockedUser = createdGuest;
        }

        const commissionRate = Number(property.commissionRate || "15");
        const commissionAmount = total * (commissionRate / 100);
        const netToHost = total - commissionAmount;
        const [inserted] = await tx
          .insert(bookings)
          .values({
            bookingReference,
            userId: lockedUser.id,
            propertyId: data.propertyId,
            roomId: data.roomId,
            // L’intent PSP est créé uniquement après ce commit, jamais sous
            // les verrous room/user. Le TTL protège ce hold si le process tombe.
            status: "pending",
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            numNights: rules.nights.length,
            numAdults: data.numAdults,
            numChildren: data.numChildren ?? 0,
            guestFirstName: data.guestFirstName,
            guestLastName: data.guestLastName,
            guestEmail: data.guestEmail,
            guestPhone: data.guestPhone,
            guestCountry: data.guestCountry,
            tripPurpose: data.tripPurpose,
            specialRequests: data.specialRequests,
            estimatedArrival: data.estimatedArrival,
            subtotal: subtotal.toFixed(2),
            taxes: taxes.toFixed(2),
            discount: discount.toFixed(2),
            total: total.toFixed(2),
            currency: room.currency || "EUR",
            paymentStatus: "pending",
            paymentMethod: null,
            paymentIntentId: null,
            paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
            promotionId: appliedPromoId,
            walletCreditsUsed: walletUsed.toFixed(2),
            ratePlanId: selectedRatePlan?.id ?? null,
            ratePlanName: selectedRatePlan?.name ?? null,
            ratePlanSnapshot: selectedRatePlan ? {
              type: selectedRatePlan.type,
              discountPercentage: selectedRatePlan.discountPercentage,
              includesBreakfast: selectedRatePlan.includesBreakfast,
              cancellationPolicy: selectedRatePlan.cancellationPolicy,
              cancellationFreeDays: selectedRatePlan.cancellationFreeDays,
              conditions: selectedRatePlan.conditions,
              baseSubtotal: baseSubtotal.toFixed(2),
              ratePlanDiscount: ratePlanDiscount.toFixed(2),
            } : null,
            commissionRate: commissionRate.toFixed(2),
            commissionAmount: commissionAmount.toFixed(2),
            netToHost: netToHost.toFixed(2),
          })
          .returning();

        if (walletUsed > 0) {
          await tx
            .update(users)
            .set({ walletBalance: Math.max(0, Number(lockedUser.walletBalance ?? "0") - walletUsed).toFixed(2) })
            .where(eq(users.id, lockedUser.id));
        }
        if (appliedPromoId) {
          await tx
            .update(promotions)
            .set({ currentUses: sql`${promotions.currentUses} + 1` })
            .where(eq(promotions.id, appliedPromoId));
        }
        return inserted;
      });
    } catch (error) {
      if (error instanceof BookingRuleError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }

    if (isGuestBooking) {
      try {
        const { clear } = await issueToken(createdBooking.userId, "guest_claim");
        const [guestUser] = await db.select({ language: users.language }).from(users).where(eq(users.id, createdBooking.userId));
        const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const mail = await templates.guestAccountClaim({
          firstName: createdBooking.guestFirstName,
          bookingReference: createdBooking.bookingReference,
          url: `${base}/activer-compte?token=${encodeURIComponent(clear)}`,
          language: guestUser?.language ?? null,
        });
        const eventKey = `guest-claim:${createdBooking.id}`;
        await enqueueEmail({ eventKey, to: createdBooking.guestEmail, ...mail });
        await deliverEmail(eventKey);
      } catch (claimError) {
        // Le booking reste valable; l’outbox ou le support peut reprendre le
        // claim sans jamais exposer le token dans la réponse API.
        console.error("[booking] guest claim email failed:", claimError);
      }
    }

    // Effet externe hors transaction. La référence booking est la clé
    // d’idempotence du PSP, et le cron reprend un intent non rattaché.
    let payment;
    try {
      payment = await createPaymentIntentForBooking(createdBooking.id);
    } catch (paymentError) {
      console.error("[booking] payment intent setup failed:", paymentError);
      return NextResponse.json({
        error: "La réservation est temporairement retenue, mais le paiement sécurisé n'a pas pu être préparé. Réessayez dans quelques instants.",
        booking: createdBooking,
      }, { status: 503 });
    }
    if (!payment) {
      return NextResponse.json({ error: "La réservation a expiré avant la préparation du paiement" }, { status: 409 });
    }
    createdBooking = payment.booking;

    return NextResponse.json(
      {
        booking: createdBooking,
        // Champ historique maintenu le temps de la migration UI.
        clientSecret: payment.clientSecret,
        payment: {
          provider: payment.provider,
          status: payment.status,
          clientSecret: payment.clientSecret,
          requiresConfirmation: payment.status !== "succeeded",
        },
        ...(isGuestBooking ? { guestAccessPending: true } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      // T-137 (A1) : libellé français (les messages Zod par défaut sont en
      // anglais et fuyaient jusqu'au client : « Too small… », « Invalid email »).
      return NextResponse.json({ error: frenchZodMessage(error) }, { status: 400 });
    }
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
