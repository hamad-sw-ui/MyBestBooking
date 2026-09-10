import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKING_REQUEST_TTL_HOURS,
  MAX_BOOKING_REQUEST_TTL_HOURS,
  bookingRequestExpiresAt,
  bookingRequestTtlHours,
} from "./booking-request-expiration";

describe("T-209 — TTL des demandes de réservation", () => {
  it("utilise 24 h par défaut", () => {
    expect(bookingRequestTtlHours(undefined)).toBe(DEFAULT_BOOKING_REQUEST_TTL_HOURS);
  });

  it("borne les valeurs invalides et trop longues", () => {
    expect(bookingRequestTtlHours("abc")).toBe(DEFAULT_BOOKING_REQUEST_TTL_HOURS);
    expect(bookingRequestTtlHours("0")).toBe(DEFAULT_BOOKING_REQUEST_TTL_HOURS);
    expect(bookingRequestTtlHours("999")).toBe(MAX_BOOKING_REQUEST_TTL_HOURS);
  });

  it("calcule une date d'expiration stable", () => {
    const now = new Date("2026-09-10T10:00:00.000Z");
    expect(bookingRequestExpiresAt(now, 6).toISOString()).toBe("2026-09-10T16:00:00.000Z");
  });
});
