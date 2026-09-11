import { NextRequest, NextResponse } from "next/server";
import { civilToday } from "@/lib/dates";
import { expireRequestsInTransaction, type ExpiredRequest } from "@/lib/booking-request-expiration";
import { notifyExpiredRequest } from "@/lib/booking-request-notifications";
import { db } from "@/db";
import { bookings, properties, promotions, ratePlans, reviews, rooms, roomAvailability, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateBookingReference } from "@/lib/utils";
import { eq, and, or, desc, lt, gt, gte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { applyPromoToTotal, isPromoUsable, normalizePromoForCurrency } from "@/lib/promotions";
import { getSetting } from "@/lib/settings";
import { apiError } from "@/lib/api-error";
import { parseApiPagination } from "@/lib/page-window";
import { resolveEffectiveCommissionRate } from "@/lib/commission";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";
import { GUEST_QUOTA_COOKIE, guestQuotaKey, rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { isUuid, zodErrorResponse } from "@/lib/http";
import { evaluateBookingRules, stayNightsWithinLimit } from "@/lib/booking-rules";
import { bookingGuestIdentity } from "@/lib/booking-identity";
import { issueToken } from "@/lib/tokens";
import { templates } from "@/lib/mail";
import { appBaseUrl } from "@/lib/app-url";
import { deliverEmail, enqueueEmail } from "@/lib/email-outbox";
import { bookingRequestExpiresAt } from "@/lib/booking-request-expiration";
import { sendBookingRequestCreatedIfNeeded } from "@/lib/booking-request-notification";

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
    // T-236 (audit n°3, F5) : la colonne `bookings.estimated_arrival` est un
    // `time`. Une chaîne libre (« vers 15 h », « 25:00 ») faisait échouer
    // l'insertion en erreur PostgreSQL (500). On valide dès la porte d'entrée,
    // en tolérant les secondes que PostgreSQL peut renvoyer.
    estimatedArrival: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Heure d'arrivée estimée invalide (HH:MM)")
      .optional(),
    promoCode: z.string().max(50).optional(),
    ratePlanId: z.string().uuid().optional(),
    useWalletCredits: z.boolean().optional(),
    // Réservation sans compte : l'API reste l'autorité, jamais le proxy.
    isGuestBooking: z.boolean().optional(),
    // T-207 : champ legacy accepté pour compatibilité, mais ignoré.
    // Toutes les réservations sont désormais des demandes sans paiement plateforme.
    payOnline: z.boolean().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    message: "La date de départ doit être postérieure à la date d'arrivée",
    path: ["checkOut"],
  });

class BookingRuleError extends Error {}
/** T-155 (audit n°27, P2) : code promo inconnu = entrée invalide → 400
 *  (les conflits d'état — expiré, épuisé, règles dispo — restent 409). */
class PromoCodeNotFoundError extends Error {}

/**
 * T-157 (audit n°29) : entrée invalide (capacité, séjour min, dates,
 * tarif corrompu) → 400 — distincte des conflits d'état (409) : une
 * demande qui ne peut JAMAIS aboutir (chambre de 2 adultes, 5 demandés)
 * n'est pas un conflit, elle doit être corrigée par le client.
 */
class BookingInputError extends Error {}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });

    const { searchParams } = new URL(request.url);
    // T-245 (audit n°5, A2) : pagination **opt-in** — sans `limit`/`offset`, la
    // réponse est strictement celle d'avant (tableau complet, aucun appelant
    // cassé) ; avec paramètres, `X-Total-Count` porte le total filtré.
    const { pagination, error: paginationError } = parseApiPagination(searchParams);
    if (paginationError) {
      return NextResponse.json({ error: await apiError(paginationError) }, { status: 400 });
    }
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
    if (propertyId) {
      if (!isUuid(propertyId)) {
        return NextResponse.json({ error: await apiError("Identifiant hébergement invalide") }, { status: 400 });
      }
      conditions.push(eq(bookings.propertyId, propertyId));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const query = db
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
        // T-152 (audit n°24, E) : état de l'avis pour la réservation (champ
        // additif — null si aucun avis ; aucun contrat existant modifié).
        review: {
          id: reviews.id,
          overallRating: reviews.overallRating,
          status: reviews.status,
        },
      })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
      .where(whereClause)
      .orderBy(desc(bookings.createdAt));

    if (!pagination) {
      const results = await query;
      return NextResponse.json({ bookings: results });
    }

    const [results, [counted]] = await Promise.all([
      query.limit(pagination.limit).offset(pagination.offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(bookings)
        .leftJoin(properties, eq(bookings.propertyId, properties.id))
        .where(whereClause),
    ]);

    return NextResponse.json(
      { bookings: results },
      { headers: { "X-Total-Count": String(counted?.total ?? 0) } },
    );
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}

/**
 * T-235 — cookie de quota des visiteurs non connectés.
 *
 * Sans cookie, tous les voyageurs d'une même IP publique (hôtel, campus,
 * opérateur mobile) partageaient le compteur. Le tunnel pose donc un
 * identifiant opaque au premier passage ; l'IP ne sert plus que de repli.
 */
function withGuestQuotaCookie(response: NextResponse, request: NextRequest): NextResponse {
  // Défensif : un cookie de quota ne doit jamais faire échouer une réservation
  // (requête sans en-têtes, objet de test, proxy amont…).
  try {
    const already =
      request.cookies?.get?.(GUEST_QUOTA_COOKIE)?.value ??
      ((request.headers?.get?.("cookie") ?? "").includes(`${GUEST_QUOTA_COOKIE}=`) ? "présent" : "");
    if (already) return response;
    response.cookies.set({
      name: GUEST_QUOTA_COOKIE,
      value: crypto.randomUUID(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  } catch (cookieError) {
    console.error("[bookings] cookie de quota non posé :", cookieError);
  }
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // T-235 (audit n°3, F4) — deux compteurs aux rôles distincts.
    //
    // AVANT : un rate-limit unique de 10/h, posé avant la validation, punissait
    // les erreurs de saisie (6 essais invalides suffisaient à bloquer une
    // demande correcte, constat reproduit) et ne disait pas combien de temps
    // attendre.
    //
    // Désormais :
    //   1. un **garde-fou anti-abus** large (60/h) posé ici, avant même la
    //      lecture du corps, donc il couvre aussi les payloads mal formés ;
    //   2. un **quota produit** (10/h) posé après les validations d'entrée (voir
    //      plus bas) : seules les demandes valides le consomment, une erreur de
    //      saisie ne coûte rien.
    const quotaKey = user
      ? `bookings:user:${user.id}`
      : guestQuotaKey(request, GUEST_QUOTA_COOKIE);
    const guard = rateLimit(`${quotaKey}:guard`, { limit: 60, windowMs: 60 * 60 * 1000 });
    if (!guard.ok) {
      const denied = NextResponse.json(
        { error: await apiError(rateLimitMessage(guard.retryAfter)) },
        { status: 429, headers: { "Retry-After": String(guard.retryAfter) } },
      );
      return !user ? withGuestQuotaCookie(denied, request) : denied;
    }

    const data = bookingSchema.parse(await request.json());
    const isGuestBooking = !user && data.isGuestBooking === true;

    if (!user && !isGuestBooking) {
      return NextResponse.json({ error: await apiError("Veuillez vous connecter pour réserver") }, { status: 401 });
    }

    // T-157 (audit n°29) : un compte connecté réserve sous SON identité. Les
    // champs invité du payload sont ignorés (le serveur est l'autorité) :
    // une confirmation ne peut jamais partir vers un email tiers saisi à la
    // main. Le guest mode (anonyme + isGuestBooking) garde son contrat.
    const guestIdentity = bookingGuestIdentity(user);

    await assertNotMaintenance(user);
    const today = civilToday();
    if (data.checkIn < today) return NextResponse.json({ error: await apiError("La date d'arrivée ne peut pas être dans le passé") }, { status: 400 });
    if (!stayNightsWithinLimit(data.checkIn, data.checkOut)) return NextResponse.json({ error: await apiError("Un séjour doit compter entre 1 et 365 nuits") }, { status: 400 });

    // Quota produit (T-235) : consommé par les demandes **validées**, une fois
    // les dates et les limites de séjour vérifiées. Un invité n'a pas encore de
    // `userId` : sa clé est son cookie visiteur, avec l'IP en repli.
    const rl = rateLimit(quotaKey, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      const denied = NextResponse.json(
        { error: await apiError(rateLimitMessage(rl.retryAfter)) },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
      return !user ? withGuestQuotaCookie(denied, request) : denied;
    }

    // T-233 (audit n°3, F2) : dernier verrou avant l'écriture — un hôte suspendu
    // ou supprimé ne peut plus recevoir de réservation, même si sa fiche était
    // encore servie par un cache ou un lien direct.
    const [listing] = await db
      .select({ property: properties, hostSuspendedAt: users.suspendedAt, hostDeletedAt: users.deletedAt })
      .from(properties)
      .innerJoin(users, eq(properties.hostId, users.id))
      .where(eq(properties.id, data.propertyId));
    const property = listing?.property;
    if (!property || property.status !== "active" || listing.hostSuspendedAt || listing.hostDeletedAt) {
      return NextResponse.json({ error: await apiError("Hébergement non disponible") }, { status: 400 });
    }
    const [room] = await db.select().from(rooms).where(and(eq(rooms.id, data.roomId), eq(rooms.propertyId, data.propertyId)));
    if (!room || !room.isActive) return NextResponse.json({ error: await apiError("Chambre non disponible") }, { status: 400 });

    if (isGuestBooking) {
      const [existing] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, data.guestEmail.toLowerCase())).limit(1);
      if (existing) {
        return NextResponse.json({
          error: await apiError(
            existing.passwordHash
              ? "Connectez-vous pour réserver avec cet email"
              : "Activez d'abord votre accès depuis l'email de confirmation, puis connectez-vous",
          ),
        }, { status: 409 });
      }
    }

    const [billing, bestrewardsSettings] = await Promise.all([
      getSetting("billing"),
      getSetting("bestrewards"),
    ]);

    const bookingReference = generateBookingReference();
    let createdBooking: typeof bookings.$inferSelect;
    // T-234 : demandes expirées libérées par cette transaction — notifiées
    // **après** le commit (jamais d'envoi d'e-mail dans une transaction).
    const expiredRequests: ExpiredRequest[] = [];

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

        // T-234 (audit n°3, F3) : une demande `pending` expirée bloquait les
        // dates jusqu'au passage du cron (quotidien) — la 2ᵉ demande sur les
        // mêmes dates recevait 409 alors que la première était morte. On purge
        // donc les demandes expirées **dans cette transaction**, limitées à la
        // chambre et à la fenêtre demandées, avant de compter les chevauchements.
        // Les notifications partent après le commit (voir plus bas).
        const expiredHere = await expireRequestsInTransaction(tx as never, new Date(), {
          roomId: data.roomId,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
        });
        expiredRequests.push(...expiredHere);

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
        if (!rules.ok) {
          // T-157 : entrée invalide → 400 (capacité, séjour min, dates, tarif) ;
          // stop-sell / chambre complète → 409 (état concurrent).
          if (rules.code && ["dates", "capacity", "min_stay", "bad_price"].includes(rules.code)) {
            throw new BookingInputError(rules.error);
          }
          throw new BookingRuleError(rules.error);
        }

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
            .limit(1)
            .for("update");
          if (!promo) throw new PromoCodeNotFoundError("Code promo : Code promo inconnu");
          const usable = isPromoUsable(promo);
          if (usable !== true) throw new BookingRuleError(`Code promo : ${usable}`);
          // T-153 (audit n°25, B) : les montants de promo sont libellés en
          // EUR ; on les convertit vers la devise de la chambre avant
          // application (1:1 interdit). Sur EUR : identité stricte.
          const result = applyPromoToTotal(
            normalizePromoForCurrency(promo, room.currency || "EUR"),
            total,
          );
          if ("error" in result) throw new BookingRuleError(`Code promo : ${result.error}`);
          // T-206/F1 : la remise promo s'ajoute à la remise du rate plan ;
          // elle ne remplace pas le discount déjà calculé.
          discount += result.discount;
          total = result.finalTotal;
          appliedPromoId = promo.id;
        }

        // T-206/F1 : BestRewards est un avantage de compte existant. En mode
        // invité, le profil est créé plus bas seulement après les validations :
        // il ne doit donc pas recevoir une remise niveau 1 invisible dans le
        // devis public. Les clients connectés conservent la logique T-205.
        if (lockedUser && user) {
          const level = lockedUser.bestrewardsLevel ?? 1;
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
        }

        // T-207 : le wallet n'est plus consommé dans le tunnel de réservation.
        // Le champ `useWalletCredits` reste accepté pour compatibilité API,
        // mais aucune déduction ni écriture de solde n'est effectuée.
        const walletUsedEur = 0;

        // Le profil invité n’est créé qu’après toutes les validations métier
        // (stock, promo, taux). Une demande rejetée n’écrit aucun user.
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

        // T-202 : priorité propriété > hôte > global (taux fixé à l'approbation).
        const commissionRate = await resolveEffectiveCommissionRate(property.hostId, property.commissionRate);
        const commissionAmount = total * (commissionRate / 100);
        const netToHost = total - commissionAmount;
        const requestExpiresAt = bookingRequestExpiresAt();
        const [inserted] = await tx
          .insert(bookings)
          .values({
            bookingReference,
            userId: lockedUser.id,
            propertyId: data.propertyId,
            roomId: data.roomId,
            // T-207 : aucune création d'intent PSP ; la réservation est une
            // demande pending que l'hôte confirme manuellement.
            status: "pending",
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            numNights: rules.nights.length,
            numAdults: data.numAdults,
            numChildren: data.numChildren ?? 0,
            // T-157 : identité du compte pour un user connecté, sinon le
            // payload invité (guest mode, inchangé).
            guestFirstName: guestIdentity?.firstName ?? data.guestFirstName,
            guestLastName: guestIdentity?.lastName ?? data.guestLastName,
            guestEmail: guestIdentity?.email ?? data.guestEmail,
            guestPhone: guestIdentity?.phone ?? data.guestPhone,
            guestCountry: guestIdentity?.country ?? data.guestCountry,
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
            // T-207 : aucune réservation ne crée de hold de paiement plateforme.
            // Même si un client legacy envoie `payOnline:true`, le booking reste
            // une demande manuelle, avec un TTL métier séparé du paiement.
            paymentExpiresAt: null,
            requestExpiresAt,
            promotionId: appliedPromoId,
            // T-207 : wallet non consommé dans le tunnel, donc aucun débit EUR.
            walletCreditsUsed: walletUsedEur.toFixed(2),
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

        if (appliedPromoId) {
          await tx
            .update(promotions)
            .set({ currentUses: sql`${promotions.currentUses} + 1` })
            .where(eq(promotions.id, appliedPromoId));
        }
        return inserted;
      });
    } catch (error) {
      if (error instanceof PromoCodeNotFoundError) {
        // T-155 (audit n°27) : 400 — entrée invalide (code inexistant).
        return NextResponse.json({ error: await apiError(error.message) }, { status: 400 });
      }
      if (error instanceof BookingInputError) {
        // T-157 (audit n°29) : 400 — entrée invalide (capacité, dates…).
        return NextResponse.json({ error: await apiError(error.message) }, { status: 400 });
      }
      if (error instanceof BookingRuleError) {
        return NextResponse.json({ error: await apiError(error.message) }, { status: 409 });
      }
      throw error;
    }

    // T-234 : la nouvelle demande a libéré des dates occupées par des demandes
    // expirées → leurs notifications partent maintenant (après commit), en
    // best-effort : un échec d'e-mail ne remet pas en cause la réservation.
    for (const expired of expiredRequests) {
      try {
        await notifyExpiredRequest(expired);
      } catch (mailError) {
        console.error("[bookings] notification d'expiration impossible :", mailError);
      }
    }

    if (isGuestBooking) {
      try {
        const { clear } = await issueToken(createdBooking.userId, "guest_claim");
        const [guestUser] = await db.select({ language: users.language }).from(users).where(eq(users.id, createdBooking.userId));
        const mail = await templates.guestAccountClaim({
          firstName: createdBooking.guestFirstName,
          bookingReference: createdBooking.bookingReference,
          url: `${appBaseUrl()}/activer-compte?token=${encodeURIComponent(clear)}`,
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

    await sendBookingRequestCreatedIfNeeded(createdBooking.id).catch((mailError) => {
      // Best-effort : la demande reste créée, l'outbox/cron pourra reprendre.
      console.error("[booking] request created email failed:", mailError);
    });

    // T-207 — réservations uniquement : aucune création d'intent PSP, même si
    // un client legacy envoie `payOnline:true`. Le contrat reste non cassant
    // côté intégrations : 201 + booking pending + payment:null.
    const created = NextResponse.json(
      {
        booking: createdBooking,
        payment: null,
        manualConfirmation: true,
        onlinePaymentDisabled: true,
        ...(isGuestBooking ? { guestAccessPending: true } : {}),
      },
      { status: 201 },
    );
    return isGuestBooking ? withGuestQuotaCookie(created, request) : created;
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      // T-137 (A1) : libellé français (les messages Zod par défaut sont en
      // anglais et fuyaient jusqu'au client : « Too small… », « Invalid email »).
      // T-241 (F13) : + `issues` champ par champ (même traduction).
      return zodErrorResponse(error);
    }
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
