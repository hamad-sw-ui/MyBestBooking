import { format } from "date-fns";

/**
 * T-195 — Moteur d'agrégation et d'idempotence des versements hôtes/admins.
 *
 * Objectif : transformer les bookings `paid` (non annulés) d'une période en un
 * ledger `payouts` (gross / commission / net par devise). La fonction est
 * PURE et testable ; l'écriture DB et l'exécution du transfert (Stripe Connect)
 * sont déléguées au reste de l'application (route API / cron / PayoutProvider).
 *
 * Règles de sécurité financière reprises du projet (T-132, T-152) :
 *  - on n'additionne JAMAIS deux devises dans un même total ;
 *  - un payout est créé PAR (hôte, période, devise) — jamais inter-devises ;
 *  - les montants sont des `number` finis, arrondis à 2 décimales (jamais de
 *    comparaison `==` sur des flottants) ;
 *  - seuls les bookings `paymentStatus='paid'` et `status != 'cancelled'`
 *    entrent (même règle que le billing).
 *
 * ⚠️ `bookings.userId` = le VOYAGEUR. L'hôte est résolu via `properties.hostId`
 * (jointure côté appelant) : la ligne `PayoutBookingRow` porte donc `hostId`.
 */

export interface PayoutBookingRow {
  // Hôte (via properties.hostId, JOIN dans la requête).
  hostId: string;
  createdAt: Date | string;
  currency: string | null;
  total: string | number | null;
  commissionAmount: string | number | null;
  netToHost: string | number | null;
  paymentStatus: string | null;
  status: string | null;
}

export interface PayoutLine {
  gross: number;
  commission: number;
  net: number;
  bookingsCount: number;
}

export interface PayoutDraft {
  hostId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD (inclusive)
  currency: string;
  gross: number;
  commission: number;
  net: number;
  bookingsCount: number;
  idempotencyKey: string;
}

/** Clé d'idempotence stable : (hôte, période, devise). Le cron peut repasser. */
export function payoutIdempotencyKey(
  hostId: string,
  periodStart: string,
  periodEnd: string,
  currency: string,
): string {
  return `payout:${hostId}:${periodStart}:${periodEnd}:${(currency || "EUR").toUpperCase()}`;
}

/** Période mensuelle précédente (YYYY-MM-DD) incluant tout le mois. */
export function previousMonthRange(now: Date = new Date()): { start: string; end: string } {
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(firstThisMonth.getFullYear(), firstThisMonth.getMonth() - 1, 1);
  const end = new Date(firstThisMonth.getFullYear(), firstThisMonth.getMonth(), 0);
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

/** Vrai si la ligne est éligible (payée, non annulée, dans la période). */
export function isPayoutEligible(b: PayoutBookingRow, hostId: string, start: string, end: string): boolean {
  if (b.hostId !== hostId) return false;
  if (b.paymentStatus !== "paid") return false;
  if (b.status === "cancelled") return false;
  const t = new Date(b.createdAt).getTime();
  const s = new Date(`${start}T00:00:00.000Z`).getTime();
  const e = new Date(`${end}T23:59:59.999Z`).getTime();
  return t >= s && t <= e;
}

/**
 * Agrège les bookings éligibles PAR devise en drafts de payout.
 * Renvoie `[]` si rien d'éligible. Les montants non finis sont ignorés
 * (jamais un NaN dans un ledger).
 */
export function aggregatePayouts(
  bookings: PayoutBookingRow[],
  hostId: string,
  start: string,
  end: string,
): PayoutDraft[] {
  const eligible = bookings.filter((b) => isPayoutEligible(b, hostId, start, end));
  const byCurrency: Record<string, PayoutLine> = {};
  for (const b of eligible) {
    const cur = (b.currency || "EUR").toUpperCase();
    const gross = Number(b.total);
    const commission = Number(b.commissionAmount);
    const net = Number(b.netToHost);
    if (!Number.isFinite(gross) || !Number.isFinite(commission) || !Number.isFinite(net)) continue;
    const line = byCurrency[cur] ??= { gross: 0, commission: 0, net: 0, bookingsCount: 0 };
    line.gross += gross;
    line.commission += commission;
    line.net += net;
    line.bookingsCount += 1;
  }

  return Object.entries(byCurrency).map(([currency, line]) => ({
    hostId,
    periodStart: start,
    periodEnd: end,
    currency,
    gross: round2(line.gross),
    commission: round2(line.commission),
    net: round2(line.net),
    bookingsCount: line.bookingsCount,
    idempotencyKey: payoutIdempotencyKey(hostId, start, end, currency),
  }));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Garde-fou d'idempotence logique : si un draft existant porte la même clé,
 * on conserve l'existant (la contrainte UNIQUE en DB reste l'arbitre final).
 */
export function pickIdempotentDraft(current: PayoutDraft | null, candidate: PayoutDraft): PayoutDraft {
  if (current && current.idempotencyKey === candidate.idempotencyKey) return current;
  return candidate;
}
