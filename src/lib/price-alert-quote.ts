import { and, eq, gte, gt, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { bookings, roomAvailability, rooms } from "@/db/schema";
import { evaluateBookingRules } from "@/lib/booking-rules";
import { convertAmount, RATES_FROM_EUR } from "@/lib/i18n";

export interface PriceAlertStayContext {
  checkIn: string;
  checkOut: string;
  numAdults: number;
  numChildren: number;
}

export interface PriceAlertQuote {
  price: number;
  currency: string;
  mode: "trip" | "base";
}

function validStayContext(input: Partial<PriceAlertStayContext>): input is PriceAlertStayContext {
  return Boolean(
    input.checkIn && input.checkOut && input.checkOut > input.checkIn
    && Number.isInteger(input.numAdults) && input.numAdults! >= 1
    && Number.isInteger(input.numChildren) && input.numChildren! >= 0,
  );
}

/**
 * Calcule le meilleur tarif actuellement réservable pour une alerte. Avec un
 * contexte de séjour, le moteur applique exactement stock, stop-sell, capacité,
 * minStay et prix journalier; sans contexte il garde le contrat historique
 * « à partir de » sur le prix de base.
 */
export async function quotePriceAlert(input: {
  propertyId: string;
  currency: string | null;
  context: Partial<PriceAlertStayContext>;
}): Promise<PriceAlertQuote | null> {
  const targetCurrency = input.currency ? input.currency.toUpperCase() : null;
  let activeRooms = await db.select().from(rooms).where(and(
    eq(rooms.propertyId, input.propertyId),
    eq(rooms.isActive, true),
    ...(targetCurrency ? [eq(rooms.currency, targetCurrency)] : []),
  ));
  // T-154c (audit n°26, P2-7) : si aucune chambre active n'existe dans la
  // devise de l'alerte (devise d'origine non EUR, chambre désactivée…),
  // retenter toutes devises et comparer le prix CONVERTI (taux figés
  // RATES_FROM_EUR). Sans cela l'alerte restait silencieusement morte
  // (quote null → cron continue sans message).
  const needsConversion = activeRooms.length === 0 && targetCurrency !== null;
  if (needsConversion) {
    activeRooms = await db.select().from(rooms).where(and(
      eq(rooms.propertyId, input.propertyId),
      eq(rooms.isActive, true),
    ));
  }
  if (!activeRooms.length) return null;

  if (!validStayContext(input.context)) {
    const prices = activeRooms
      .map((room) => ({ price: Number(room.basePrice), currency: room.currency ?? "EUR" }))
      .filter((p) => Number.isFinite(p.price));
    if (!prices.length) return null;
    let best = prices[0]!;
    if (needsConversion) {
      // Min réellement le moins cher APRÈS conversion EUR (les devises
      // peuvent différer dans le fallback) ; sinon comportement historique
      // (min brut, contrainte devise identique).
      for (const p of prices) {
        const eur = p.price / (RATES_FROM_EUR[p.currency] ?? 1);
        const bestEur = best.price / (RATES_FROM_EUR[best.currency] ?? 1);
        if (eur < bestEur) best = p;
      }
      return { price: convertAmount(best.price, best.currency, targetCurrency!), currency: targetCurrency!, mode: "base" };
    }
    return { price: Math.min(...prices.map((p) => p.price)), currency: input.currency ?? activeRooms[0]!.currency ?? "EUR", mode: "base" };
  }

  let cheapest: PriceAlertQuote | null = null;
  for (const room of activeRooms) {
    const [availability, overlaps] = await Promise.all([
      db.select({
        date: roomAvailability.date,
        availableCount: roomAvailability.availableCount,
        price: roomAvailability.price,
        stopSell: roomAvailability.stopSell,
        minStay: roomAvailability.minStay,
      }).from(roomAvailability).where(and(
        eq(roomAvailability.roomId, room.id),
        gte(roomAvailability.date, input.context.checkIn),
        lt(roomAvailability.date, input.context.checkOut),
      )),
      db.select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
        .from(bookings)
        .where(and(
          eq(bookings.roomId, room.id),
          ne(bookings.status, "cancelled"),
          lt(bookings.checkIn, input.context.checkOut),
          gt(bookings.checkOut, input.context.checkIn),
        )),
    ]);
    const rules = evaluateBookingRules({
      room: {
        maxOccupancy: room.maxOccupancy,
        maxAdults: room.maxAdults,
        maxChildren: room.maxChildren,
        quantity: room.quantity ?? 1,
        basePrice: room.basePrice,
      },
      ...input.context,
      availability,
      overlappingBookings: overlaps,
    });
    if (!rules.ok) continue;
    const price = rules.nightlyPrices.reduce((total, nightly) => total + nightly, 0);
    if (!cheapest || price < cheapest.price) cheapest = { price, currency: room.currency ?? "EUR", mode: "trip" };
  }
  if (cheapest && needsConversion) {
    return {
      price: convertAmount(cheapest.price, cheapest.currency, targetCurrency!),
      currency: targetCurrency!,
      mode: "trip",
    };
  }
  return cheapest;
}
