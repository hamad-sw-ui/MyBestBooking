import { describe, expect, it } from "vitest";
import { shouldNotifyPriceAlert } from "./price-alert-rules";

describe("shouldNotifyPriceAlert", () => {
  it("notifie au premier seuil atteint puis seulement à une baisse supplémentaire", () => {
    expect(shouldNotifyPriceAlert({ currentPrice: 99, maxPrice: 100, lastNotifiedPrice: null })).toBe(true);
    expect(shouldNotifyPriceAlert({ currentPrice: 99, maxPrice: 100, lastNotifiedPrice: "99" })).toBe(false);
    expect(shouldNotifyPriceAlert({ currentPrice: 90, maxPrice: 100, lastNotifiedPrice: "99" })).toBe(true);
  });

  it("ne notifie pas au-dessus du seuil", () => {
    expect(shouldNotifyPriceAlert({ currentPrice: 101, maxPrice: 100, lastNotifiedPrice: null })).toBe(false);
  });
});

import { isStayExpired, isStayPast } from "./price-alert-rules";

describe("T-161 — expiration/validité des alertes séjour", () => {
  it("isStayExpired : départ passé → true ; futur/absent → false", () => {
    expect(isStayExpired("2020-01-12", "2026-08-30")).toBe(true);
    expect(isStayExpired("2099-01-12", "2026-08-30")).toBe(false);
    expect(isStayExpired(null, "2026-08-30")).toBe(false);
  });

  it("isStayPast : arrivée passée → true ; aujourd'hui/futur → false", () => {
    expect(isStayPast("2020-01-10", "2026-08-30")).toBe(true);
    expect(isStayPast("2026-08-30", "2026-08-30")).toBe(false);
    expect(isStayPast("2099-01-10", "2026-08-30")).toBe(false);
    expect(isStayPast(null, "2026-08-30")).toBe(false);
  });
});
