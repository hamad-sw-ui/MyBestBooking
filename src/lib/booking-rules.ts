/**
 * Règles métier pures partagées par devis et création de réservation.
 *
 * Les dates sont manipulées sous forme YYYY-MM-DD afin de préserver la
 * convention hôtelière [checkIn, checkOut) sans subir les décalages timezone
 * du navigateur ou du serveur.
 */

export interface BookingRoomRules {
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number | null;
  quantity: number;
  basePrice: string;
}

export interface AvailabilityDayRule {
  date: string | Date;
  availableCount: number;
  price: string | null;
  stopSell: boolean | null;
  minStay: number | null;
}

export interface OverlappingBookingRule {
  checkIn: string | Date;
  checkOut: string | Date;
}

export interface BookingRuleResult {
  ok: boolean;
  error?: string;
  nights: string[];
  nightlyPrices: number[];
}

function toIsoDate(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Retourne chaque nuit du séjour [checkIn, checkOut). */
export function stayNights(checkIn: string, checkOut: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || checkOut <= checkIn) {
    return [];
  }

  const nights: string[] = [];
  const cursor = new Date(`${checkIn}T00:00:00.000Z`);
  while (cursor.toISOString().slice(0, 10) < checkOut) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

/** Valide adultes, enfants et total contre les règles de la chambre. */
export function capacityError(
  room: Pick<BookingRoomRules, "maxOccupancy" | "maxAdults" | "maxChildren">,
  numAdults: number,
  numChildren: number,
): string | null {
  if (!Number.isInteger(numAdults) || numAdults < 1) {
    return "Le nombre d'adultes est invalide";
  }
  if (!Number.isInteger(numChildren) || numChildren < 0) {
    return "Le nombre d'enfants est invalide";
  }
  if (numAdults > room.maxAdults) {
    return `Cette chambre accepte au maximum ${room.maxAdults} adulte${room.maxAdults > 1 ? "s" : ""}`;
  }
  const maxChildren = room.maxChildren ?? 0;
  if (numChildren > maxChildren) {
    return `Cette chambre accepte au maximum ${maxChildren} enfant${maxChildren > 1 ? "s" : ""}`;
  }
  if (numAdults + numChildren > room.maxOccupancy) {
    return `Cette chambre accepte au maximum ${room.maxOccupancy} personne${room.maxOccupancy > 1 ? "s" : ""}`;
  }
  return null;
}

/**
 * Vérifie le stock par nuit, stop-sell, séjour minimum d'arrivée et calcule
 * les prix journaliers. Les réservations fournies doivent être les seules
 * bookings non annulées pouvant se chevaucher avec le séjour demandé.
 */
export function evaluateBookingRules(input: {
  room: BookingRoomRules;
  checkIn: string;
  checkOut: string;
  numAdults: number;
  numChildren: number;
  availability: AvailabilityDayRule[];
  overlappingBookings: OverlappingBookingRule[];
}): BookingRuleResult {
  const nights = stayNights(input.checkIn, input.checkOut);
  if (nights.length === 0) {
    return { ok: false, error: "La date de départ doit être postérieure à la date d'arrivée", nights: [], nightlyPrices: [] };
  }

  const capacity = capacityError(input.room, input.numAdults, input.numChildren);
  if (capacity) return { ok: false, error: capacity, nights, nightlyPrices: [] };

  const byDate = new Map(input.availability.map((day) => [toIsoDate(day.date), day]));
  const arrivalRule = byDate.get(input.checkIn);
  const minimumStay = arrivalRule?.minStay ?? 1;
  if (nights.length < minimumStay) {
    return {
      ok: false,
      error: `Cet hébergement exige un séjour minimum de ${minimumStay} nuit${minimumStay > 1 ? "s" : ""}`,
      nights,
      nightlyPrices: [],
    };
  }

  const nightlyPrices: number[] = [];
  for (const night of nights) {
    const rule = byDate.get(night);
    if (rule?.stopSell) {
      return { ok: false, error: "Cette chambre n'est plus disponible pour ces dates", nights, nightlyPrices: [] };
    }

    // Une règle journalière réduit éventuellement le stock ; elle ne peut pas
    // l'augmenter au-delà du stock structurel de la chambre.
    const capacityForNight = Math.min(rule?.availableCount ?? input.room.quantity, input.room.quantity);
    const occupiedForNight = input.overlappingBookings.filter((booking) => {
      const bookingIn = toIsoDate(booking.checkIn);
      const bookingOut = toIsoDate(booking.checkOut);
      return bookingIn <= night && bookingOut > night;
    }).length;

    if (capacityForNight <= occupiedForNight) {
      return { ok: false, error: "Cette chambre n'est plus disponible pour ces dates", nights, nightlyPrices: [] };
    }

    const price = Number(rule?.price ?? input.room.basePrice);
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: "Le tarif de la chambre est invalide", nights, nightlyPrices: [] };
    }
    nightlyPrices.push(price);
  }

  return { ok: true, nights, nightlyPrices };
}

/** Borne opérationnelle commune, protège API et calculs contre plages abusives. */
export const MAX_STAY_NIGHTS = 365;
export function stayNightsWithinLimit(checkIn: string, checkOut: string, max = MAX_STAY_NIGHTS): boolean {
  const nights = stayNights(checkIn, checkOut);
  return nights.length > 0 && nights.length <= max;
}
