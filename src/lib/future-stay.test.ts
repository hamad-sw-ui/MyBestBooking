import { describe, expect, it } from "vitest";
import { hasInvalidRequestedStay, parseFutureStay } from "./future-stay";

describe("future-stay (T-206/F6)", () => {
  it("accepte un séjour futur strictement ordonné", () => {
    expect(parseFutureStay("2026-09-11", "2026-09-12", "2026-09-10")).toEqual({
      checkIn: "2026-09-11",
      checkOut: "2026-09-12",
    });
  });

  it("rejette dates passées, incomplètes ou inversées quand elles sont demandées", () => {
    expect(hasInvalidRequestedStay("2020-01-01", "2020-01-03", "2026-09-10")).toBe(true);
    expect(hasInvalidRequestedStay("2026-09-12", "2026-09-11", "2026-09-10")).toBe(true);
    expect(hasInvalidRequestedStay("2026-09-11", null, "2026-09-10")).toBe(true);
    expect(hasInvalidRequestedStay(null, null, "2026-09-10")).toBe(false);
  });
});
