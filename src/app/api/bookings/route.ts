import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties, rooms, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateBookingReference, calculateNights } from "@/lib/utils";
import { eq, and, or, desc, lt, gt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getMailer, templates } from "@/lib/mail";
import { promotions } from "@/db/schema";
import { applyPromoToTotal, isPromoUsable } from "@/lib/promotions";
import { getPaymentProvider } from "@/lib/payment";
import { getSetting } from "@/lib/settings";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";
import { rateLimit } from "@/lib/rate-limit";

const bookingSchema = z
  .object({
    propertyId: z.string().uuid(),
    roomId: z.string().uuid(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn doit être au format YYYY-MM-DD"),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut doit être au format YYYY-MM-DD"),
    numAdults: z.number().min(1),
    numChildren: z.number().min(0).optional(),
    guestFirstName: z.string().min(2),
    guestLastName: z.string().min(2),
    guestEmail: z.string().email(),
    guestPhone: z.string().optional(),
    guestCountry: z.string().length(2).optional(),
    tripPurpose: z.enum(["leisure", "business"]).optional(),
    specialRequests: z.string().optional(),
    estimatedArrival: z.string().optional(),
    promoCode: z.string().max(50).optional(),
    // T-027 : appliquer le walletBalance de l'user en réduction
    useWalletCredits: z.boolean().optional(),
    // T-029 : réservation invité (guest booking, sans compte)
    isGuestBooking: z.boolean().optional(),
  })
  // T-006 (BUG-011) : validation métier avant d'atteindre la contrainte
  // SQL, message utilisateur plus clair.
  .refine((d) => new Date(d.checkOut) > new Date(d.checkIn), {
    message: "La date de départ doit être postérieure à la date d'arrivée",
    path: ["checkOut"],
  });

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const propertyId = searchParams.get("propertyId");

    let conditions = [];

    // If user is a customer, only show their bookings
    if (user.role === "customer") {
      conditions.push(eq(bookings.userId, user.id));
    } else if (user.role === "host") {
      // If user is a host, show bookings for their properties
      const hostProperties = await db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.hostId, user.id));
      
      const propertyIds = hostProperties.map((p) => p.id);
      if (propertyIds.length > 0) {
        conditions.push(or(...propertyIds.map((id) => eq(bookings.propertyId, id)))!);
      } else {
        return NextResponse.json({ bookings: [] });
      }
    }
    // Admins see all bookings

    if (status) {
      conditions.push(eq(bookings.status, status));
    }

    if (propertyId) {
      conditions.push(eq(bookings.propertyId, propertyId));
    }

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
        room: {
          id: rooms.id,
          name: rooms.name,
          roomType: rooms.roomType,
        },
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookings.createdAt));

    return NextResponse.json({ bookings: results });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let user = await getCurrentUser();
    // T-029 : guest booking (isGuestBooking:true) — pas de user
    // connecté requis. On crée un user « guest » stub (pas de mdp,
    // emailVerified=false) et on continue.
    const body = await request.json();
    const data = bookingSchema.parse(body);

    if (!user && !data.isGuestBooking) {
      return NextResponse.json(
        { error: "Veuillez vous connecter pour réserver" },
        { status: 401 }
      );
    }

    if (!user && data.isGuestBooking) {
      // Trouve un user existant avec cet email, sinon en crée un stub.
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, data.guestEmail.toLowerCase()))
        .limit(1);
      if (existing) {
        user = existing;
      } else {
        const [created] = await db
          .insert(users)
          .values({
            email: data.guestEmail.toLowerCase(),
            firstName: data.guestFirstName,
            lastName: data.guestLastName,
            phone: data.guestPhone ?? null,
            country: data.guestCountry ?? null,
            role: "customer",
            emailVerified: false,
            passwordHash: null,
          })
          .returning();
        user = created;
      }
    }
    // Type-guard : user est garanti non null à ce point.
    if (!user) {
      return NextResponse.json({ error: "État inattendu" }, { status: 500 });
    }

    // T-022 : mode maintenance — bloquer les réservations pour les non-admins.
    await assertNotMaintenance(user);

    // T-028 : rate-limit anti-spam sur POST /api/bookings.
    const rl = rateLimit(`bookings:user:${user.id}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop de tentatives, réessayez plus tard" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    // Get property and room
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, data.propertyId));

    if (!property || property.status !== "active") {
      return NextResponse.json(
        { error: "Hébergement non disponible" },
        { status: 400 }
      );
    }

    const [room] = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, data.roomId), eq(rooms.propertyId, data.propertyId)));

    if (!room || !room.isActive) {
      return NextResponse.json(
        { error: "Chambre non disponible" },
        { status: 400 }
      );
    }

    // Calculate pricing
    // T-021 : le taux de TVA est désormais lu depuis app_settings
    // (défaut 0.10 = comportement d'origine). Idem pour les seuils
    // BestRewards plus bas.
    const billing = await getSetting("billing");
    const numNights = calculateNights(data.checkIn, data.checkOut);
    const subtotal = parseFloat(room.basePrice) * numNights;
    const taxes = subtotal * billing.taxRate;
    let discount = 0;
    let appliedPromoId: string | null = null;
    let promoErrorMsg: string | null = null;
    let total = subtotal + taxes;

    // T-016 : application d'un code promo si fourni.
    if (data.promoCode) {
      const [promo] = await db
        .select()
        .from(promotions)
        .where(eq(promotions.code, data.promoCode.toUpperCase()))
        .limit(1);
      if (!promo) {
        promoErrorMsg = "Code promo inconnu";
      } else {
        const usable = isPromoUsable(promo);
        if (usable !== true) {
          promoErrorMsg = usable;
        } else {
          const res = applyPromoToTotal(promo, total);
          if ("error" in res) {
            promoErrorMsg = res.error;
          } else {
            discount = res.discount;
            total = res.finalTotal;
            appliedPromoId = promo.id;
          }
        }
      }
      if (promoErrorMsg) {
        return NextResponse.json(
          { error: `Code promo : ${promoErrorMsg}` },
          { status: 400 },
        );
      }
    }

    // T-027 : bonus BestRewards level user + property.isBestrewards.
    // Level 2/3 → réduction % lue depuis settings.bestrewards.discounts.
    // Property isBestrewards → +2 pp de réduction pour renforcer
    // l'attractivité (bornage à 30% max total pour éviter les abus).
    const bestrewardsSettings = await getSetting("bestrewards");
    const userLevel = user.bestrewardsLevel ?? 1;
    let bestrewardsPercent = 0;
    if (userLevel >= 3) bestrewardsPercent = bestrewardsSettings.discounts[2];
    else if (userLevel >= 2) bestrewardsPercent = bestrewardsSettings.discounts[1];
    else bestrewardsPercent = 0; // Level 1 pas de réduction auto
    if (property.isBestrewards && userLevel >= 2) {
      bestrewardsPercent = Math.min(30, bestrewardsPercent + 2);
    }
    if (bestrewardsPercent > 0) {
      const bonusDiscount = Math.round(total * (bestrewardsPercent / 100) * 100) / 100;
      discount += bonusDiscount;
      total = Math.max(0, total - bonusDiscount);
    }

    // T-027 : wallet — utilise le crédit user comme réduction,
    // plafonné au total restant. Ne peut jamais rendre le total < 0.
    let walletUsed = 0;
    if (data.useWalletCredits) {
      const wallet = parseFloat(user.walletBalance ?? "0");
      if (wallet > 0) {
        walletUsed = Math.min(wallet, total);
        total = Math.max(0, total - walletUsed);
        discount += walletUsed;
      }
    }

    const commissionRate = parseFloat(property.commissionRate || "15");
    const commissionAmount = total * (commissionRate / 100);
    const netToHost = total - commissionAmount;

    const bookingReference = generateBookingReference();

    // T-012 : vérification atomique de disponibilité.
    // Transaction avec SELECT ... FOR UPDATE sur les bookings de la même
    // room et non annulés. `room.quantity` détermine combien d'unités
    // identiques sont disponibles (ex: "Chambre Standard × 3").
    // Convention : deux intervalles [aIn, aOut) et [bIn, bOut) se
    // chevauchent ssi aIn < bOut ET aOut > bIn. Adjacent = pas overlap.
    let newBooking;
    let clientSecret: string | null = null;
    try {
      newBooking = await db.transaction(async (tx) => {
        const overlaps = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(
            and(
              eq(bookings.roomId, data.roomId),
              ne(bookings.status, "cancelled"),
              lt(bookings.checkIn, data.checkOut),
              gt(bookings.checkOut, data.checkIn),
            ),
          )
          .for("update");

        const roomCapacity = room.quantity ?? 1;
        if (overlaps.length >= roomCapacity) {
          throw new Error("ROOM_UNAVAILABLE");
        }

        // T-020 : crée un payment intent via le provider actif
        // (Mock si Stripe non configuré → "paid" immédiat, sinon
        // "pending" jusqu'au webhook Stripe).
        const provider = getPaymentProvider();
        const intent = await provider.create({
          amount: Math.round(total * 100), // cents
          currency: (room.currency || "EUR").toUpperCase(),
          bookingReference,
          guestEmail: data.guestEmail,
        });
        clientSecret = intent.clientSecret;
        const initialStatus =
          intent.status === "succeeded" ? "paid" : "pending";
        const bookingStatus =
          intent.status === "succeeded" ? "confirmed" : "pending";

        const [inserted] = await tx
          .insert(bookings)
          .values({
            bookingReference,
            userId: user.id,
            propertyId: data.propertyId,
            roomId: data.roomId,
            status: bookingStatus,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            numNights,
            numAdults: data.numAdults,
            numChildren: data.numChildren || 0,
            guestFirstName: data.guestFirstName,
            guestLastName: data.guestLastName,
            guestEmail: data.guestEmail,
            guestPhone: data.guestPhone,
            guestCountry: data.guestCountry,
            tripPurpose: data.tripPurpose,
            specialRequests: data.specialRequests,
            subtotal: subtotal.toFixed(2),
            taxes: taxes.toFixed(2),
            discount: discount.toFixed(2),
            total: total.toFixed(2),
            currency: room.currency || "EUR",
            paymentStatus: initialStatus,
            paymentMethod: "card",
            paymentIntentId: intent.id,
            commissionRate: commissionRate.toFixed(2),
            commissionAmount: commissionAmount.toFixed(2),
            netToHost: netToHost.toFixed(2),
          })
          .returning();

        // T-016 : consume promo (atomique dans la même transaction)
        if (appliedPromoId) {
          await tx
            .update(promotions)
            .set({ currentUses: sql`${promotions.currentUses} + 1` })
            .where(eq(promotions.id, appliedPromoId));
        }
        return inserted;
      });
    } catch (e) {
      if (e instanceof Error && e.message === "ROOM_UNAVAILABLE") {
        return NextResponse.json(
          { error: "Cette chambre n'est plus disponible pour ces dates" },
          { status: 409 },
        );
      }
      throw e;
    }

    // Update user's BestRewards count
    // T-021 : seuils lus depuis app_settings (défaut [5, 15]).
    const br = await getSetting("bestrewards");
    const newCount = (user.bestrewardsBookingsCount || 0) + 1;
    const newLevel = newCount >= br.thresholds[1]
      ? 3
      : newCount >= br.thresholds[0]
        ? 2
        : 1;
    // T-027 : débite le wallet si utilisé.
    const walletAfter = walletUsed > 0
      ? Math.max(0, parseFloat(user.walletBalance ?? "0") - walletUsed)
      : parseFloat(user.walletBalance ?? "0");
    await db
      .update(users)
      .set({
        bestrewardsBookingsCount: newCount,
        bestrewardsLevel: newLevel,
        walletBalance: walletAfter.toFixed(2),
      })
      .where(eq(users.id, user.id));

    // T-013 : emails de confirmation (voyageur) et notification (hôte).
    // Best-effort : n'annule pas la réservation en cas d'échec SMTP.
    try {
      const mailer = getMailer();
      // Confirmation voyageur
      const confirmMail = await templates.bookingConfirmation({
        firstName: data.guestFirstName,
        bookingReference,
        propertyName: property.name,
        city: property.city,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        total: total.toFixed(2),
        currency: room.currency || "EUR",
      });
      await mailer.send({ to: data.guestEmail, ...confirmMail });
      // Notification hôte
      const [host] = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, property.hostId));
      if (host) {
        const hostMail = await templates.bookingHostNotification({
          hostFirstName: host.firstName,
          bookingReference,
          propertyName: property.name,
          guestName: `${data.guestFirstName} ${data.guestLastName}`,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
        });
        await mailer.send({ to: host.email, ...hostMail });
      }
    } catch (mailErr) {
      console.error("[booking] confirmation mail failed:", mailErr);
    }

    return NextResponse.json(
      { booking: newBooking, clientSecret },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MaintenanceError) {
      return maintenanceResponse(error.retryAfterSeconds);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
