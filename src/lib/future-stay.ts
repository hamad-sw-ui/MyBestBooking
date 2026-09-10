const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface FutureStay {
  checkIn: string;
  checkOut: string;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hasStayRequest(checkIn?: string | null, checkOut?: string | null): boolean {
  return Boolean(checkIn?.trim() || checkOut?.trim());
}

/**
 * Parse un séjour réservable à venir. Retourne null si dates absentes,
 * incomplètes, mal formées, inversées ou passées.
 */
export function parseFutureStay(
  checkIn?: string | null,
  checkOut?: string | null,
  today: string = todayIso(),
): FutureStay | null {
  const ci = checkIn?.trim();
  const co = checkOut?.trim();
  if (!ci || !co) return null;
  if (!DATE_RE.test(ci) || !DATE_RE.test(co)) return null;
  if (co <= ci) return null;
  if (DATE_RE.test(today) && ci < today) return null;
  return { checkIn: ci, checkOut: co };
}

export function hasInvalidRequestedStay(
  checkIn?: string | null,
  checkOut?: string | null,
  today: string = todayIso(),
): boolean {
  return hasStayRequest(checkIn, checkOut) && !parseFutureStay(checkIn, checkOut, today);
}
