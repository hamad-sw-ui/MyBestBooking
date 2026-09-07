import { describe, it, expect } from "vitest";
import {
  previousMonthRange,
  payoutIdempotencyKey,
  aggregatePayouts,
  isPayoutEligible,
  pickIdempotentDraft,
  type PayoutBookingRow,
} from "./payouts";

const row = (over: Partial<PayoutBookingRow> = {}): PayoutBookingRow => ({
  hostId: "host-1",
  createdAt: "2026-08-15T10:00:00.000Z",
  currency: "EUR",
  total: "200.00",
  commissionAmount: "30.00",
  netToHost: "170.00",
  paymentStatus: "paid",
  status: "confirmed",
  ...over,
});

describe("previousMonthRange (T-195)", () => {
  it("retourne le mois précédent inclusif", () => {
    const r = previousMonthRange(new Date("2026-09-06"));
    expect(r.start).toBe("2026-08-01");
    expect(r.end).toBe("2026-08-31");
  });
});

describe("payoutIdempotencyKey (T-195)", () => {
  it("stable et normalisée (hôte, période, devise en majuscules)", () => {
    expect(payoutIdempotencyKey("h1", "2026-08-01", "2026-08-31", "eur"))
      .toBe("payout:h1:2026-08-01:2026-08-31:EUR");
  });
});

describe("isPayoutEligible (T-195)", () => {
  it("exige paiement payé, non annulé, dans la période", () => {
    expect(isPayoutEligible(row(), "host-1", "2026-08-01", "2026-08-31")).toBe(true);
    expect(isPayoutEligible(row({ paymentStatus: "pending" }), "host-1", "2026-08-01", "2026-08-31")).toBe(false);
    expect(isPayoutEligible(row({ status: "cancelled" }), "host-1", "2026-08-01", "2026-08-31")).toBe(false);
    expect(isPayoutEligible(row(), "host-1", "2026-09-01", "2026-09-30")).toBe(false);
    expect(isPayoutEligible(row(), "host-2", "2026-08-01", "2026-08-31")).toBe(false);
  });
});

describe("aggregatePayouts (T-195)", () => {
  it("agrège gross/commission/net par devise, jamais inter-devises", () => {
    const drafts = aggregatePayouts([
      row({ hostId: "host-1", total: "200", commissionAmount: "30", netToHost: "170" }),
      row({ hostId: "host-1", total: "100", commissionAmount: "15", netToHost: "85" }),
    ], "host-1", "2026-08-01", "2026-08-31");
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      gross: 300,
      commission: 45,
      net: 255,
      bookingsCount: 2,
      currency: "EUR",
      idempotencyKey: "payout:host-1:2026-08-01:2026-08-31:EUR",
    });
  });

  it("sépare les devises en drafts distincts", () => {
    const drafts = aggregatePayouts([
      row({ total: "200", currency: "EUR" }),
      row({ total: "100000", currency: "XAF" }),
    ], "host-1", "2026-08-01", "2026-08-31");
    expect(drafts).toHaveLength(2);
    expect(drafts.map(d => d.currency).sort()).toEqual(["EUR", "XAF"]);
  });

  it("ignore un montant non fini (NaN) sans polluer le ledger", () => {
    const drafts = aggregatePayouts([
      row({ total: "200", netToHost: "170", commissionAmount: "30" }),
      row({ total: "not-a-number", netToHost: "zzz", commissionAmount: "1" }),
    ], "host-1", "2026-08-01", "2026-08-31");
    expect(drafts).toHaveLength(1);
    expect(drafts[0].bookingsCount).toBe(1);
  });

  it("renvoie [] pour un hôte sans booking éligible", () => {
    expect(aggregatePayouts([], "host-1", "2026-08-01", "2026-08-31")).toEqual([]);
  });
});

describe("pickIdempotentDraft (T-195)", () => {
  it("conserve l'existant quand la clé correspond", () => {
    const a = {
      hostId: "h", periodStart: "2026-08-01", periodEnd: "2026-08-31",
      currency: "EUR", gross: 1, commission: 1, net: 1, bookingsCount: 1,
      idempotencyKey: "k",
    };
    const b = { ...a, net: 2 };
    expect(pickIdempotentDraft(a, b)).toBe(a);
    expect(pickIdempotentDraft(null, b)).toBe(b);
  });
});
