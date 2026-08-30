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
