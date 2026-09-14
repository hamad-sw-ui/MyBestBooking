import { and, eq, gte, gt, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { bookings, roomAvailability, rooms } from "@/db/schema";
import { evaluateBookingRules } from "@/lib/booking-rules";
import { convertAmount, isDisplayCurrency } from "@/lib/i18n";

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
  const requestedCurrency = input.currency?.trim().toUpperCase() || null;
  // Les alertes enregistrées sont validées, mais des chambres legacy peuvent
  // encore porter un code inconnu. Une telle ligne ne doit jamais être
  // relabellisée comme la devise cible après un fallback 1:1 de convertAmount.
  const targetCurrency = requestedCurrency && isDisplayCurrency(requestedCurrency)
    ? requestedCurrency
    : null;
  const activeRooms = await db.select().from(rooms).where(and(
    eq(rooms.propertyId, input.propertyId),
    eq(rooms.isActive, true),
  ));
  if (!activeRooms.length) return null;

  if (!validStayContext(input.context)) {
    const prices = activeRooms
      .map((room) => ({ price: Number(room.basePrice), currency: room.currency ?? "EUR" }))
      .filter((p) => Number.isFinite(p.price));
    if (!prices.length) return null;
    const comparablePrices = targetCurrency
      ? prices.filter((p) => isDisplayCurrency(p.currency))
      : prices;
    if (!comparablePrices.length) return null;
    let best = comparablePrices[0]!;
    if (targetCurrency) {
      for (const p of comparablePrices) {
        const converted = convertAmount(p.price, p.currency, targetCurrency);
        const bestConverted = convertAmount(best.price, best.currency, targetCurrency);
        if (converted < bestConverted) best = p;
      }
      return { price: convertAmount(best.price, best.currency, targetCurrency), currency: targetCurrency, mode: "base" };
    }
    return { price: Math.min(...prices.map((p) => p.price)), currency: activeRooms[0]!.currency ?? "EUR", mode: "base" };
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
    const roomCurrency = room.currency ?? "EUR";
    if (targetCurrency && !isDisplayCurrency(roomCurrency)) continue;
    const comparisonPrice = targetCurrency ? convertAmount(price, roomCurrency, targetCurrency) : price;
    if (!cheapest || comparisonPrice < cheapest.price) {
      cheapest = { price: comparisonPrice, currency: targetCurrency ?? roomCurrency, mode: "trip" };
    }
  }
  return cheapest;
}
