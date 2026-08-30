export interface ReservationUrlInput {
  propertyId: string;
  roomId: string;
  checkIn?: string | null;
  checkOut?: string | null;
  numAdults?: number | null;
  numChildren?: number | null;
}

/** Convention unique pour tous les CTA de réservation. */
export function buildReservationUrl(input: ReservationUrlInput): string {
  const query = new URLSearchParams({ property: input.propertyId, room: input.roomId });
  if (input.checkIn) query.set("checkIn", input.checkIn);
  if (input.checkOut) query.set("checkOut", input.checkOut);
  if (input.numAdults && input.numAdults > 0) query.set("adults", String(input.numAdults));
  if (input.numChildren && input.numChildren > 0) query.set("children", String(input.numChildren));
  return `/reservation?${query.toString()}`;
}

/** Accepte les paramètres historiques propertyId/roomId sans générer de nouveaux liens legacy. */
export function readReservationParams(params: URLSearchParams): ReservationUrlInput | null {
  const propertyId = params.get("property") ?? params.get("propertyId");
  const roomId = params.get("room") ?? params.get("roomId");
  if (!propertyId || !roomId) return null;
  const adults = Number(params.get("adults") ?? "2");
  const children = Number(params.get("children") ?? "0");
  return {
    propertyId,
    roomId,
    checkIn: params.get("checkIn"),
    checkOut: params.get("checkOut"),
    numAdults: Number.isInteger(adults) && adults > 0 ? adults : 2,
    numChildren: Number.isInteger(children) && children >= 0 ? children : 0,
  };
}
