import { describe, expect, it } from "vitest";
import { capacityError, evaluateBookingRules, stayNights } from "./booking-rules";

const room = {
  maxOccupancy: 2,
  maxAdults: 2,
  maxChildren: 0,
  quantity: 3,
  basePrice: "100.00",
};

describe("booking-rules", () => {
  it("énumère les nuits selon la convention [checkIn, checkOut)", () => {
    expect(stayNights("2027-03-01", "2027-03-04")).toEqual([
      "2027-03-01",
      "2027-03-02",
      "2027-03-03",
    ]);
    expect(stayNights("2027-03-01", "2027-03-01")).toEqual([]);
  });

  it("refuse les voyageurs au-delà des limites de la chambre", () => {
    expect(capacityError(room, 3, 0)).toMatch(/2 adultes/);
    expect(capacityError(room, 2, 1)).toMatch(/0 enfant/);
    expect(capacityError(room, 6, 4)).toMatch(/2 adultes/);
    expect(capacityError(room, 2, 0)).toBeNull();
  });

  it("respecte le stock journalier inférieur à quantity", () => {
    const result = evaluateBookingRules({
      room,
      checkIn: "2027-11-10",
      checkOut: "2027-11-12",
      numAdults: 2,
      numChildren: 0,
      availability: [
        { date: "2027-11-10", availableCount: 1, price: null, stopSell: false, minStay: 1 },
        { date: "2027-11-11", availableCount: 1, price: null, stopSell: false, minStay: 1 },
      ],
      overlappingBookings: [{ checkIn: "2027-11-10", checkOut: "2027-11-12" }],
    });
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/plus disponible/) });
  });

  it("accepte le stock libre et applique un prix journalier override", () => {
    const result = evaluateBookingRules({
      room,
      checkIn: "2027-11-10",
      checkOut: "2027-11-12",
      numAdults: 2,
      numChildren: 0,
      availability: [
        { date: "2027-11-10", availableCount: 1, price: "120.00", stopSell: false, minStay: 1 },
        { date: "2027-11-11", availableCount: 1, price: null, stopSell: false, minStay: 1 },
      ],
      overlappingBookings: [],
    });
    expect(result).toEqual({ ok: true, nights: ["2027-11-10", "2027-11-11"], nightlyPrices: [120, 100] });
  });

  it("refuse stop-sell et un séjour inférieur au minimum de la date d'arrivée", () => {
    const minStay = evaluateBookingRules({
      room,
      checkIn: "2027-11-10",
      checkOut: "2027-11-12",
      numAdults: 1,
      numChildren: 0,
      availability: [{ date: "2027-11-10", availableCount: 3, price: null, stopSell: false, minStay: 3 }],
      overlappingBookings: [],
    });
    expect(minStay).toMatchObject({ ok: false, error: expect.stringMatching(/minimum de 3/) });

    const stopSell = evaluateBookingRules({
      room,
      checkIn: "2027-11-10",
      checkOut: "2027-11-12",
      numAdults: 1,
      numChildren: 0,
      availability: [{ date: "2027-11-11", availableCount: 3, price: null, stopSell: true, minStay: 1 }],
      overlappingBookings: [],
    });
    expect(stopSell).toMatchObject({ ok: false, error: expect.stringMatching(/plus disponible/) });
  });

  it("ne compte pas un séjour adjacent comme une occupation", () => {
    const result = evaluateBookingRules({
      room,
      checkIn: "2027-11-12",
      checkOut: "2027-11-13",
      numAdults: 1,
      numChildren: 0,
      availability: [{ date: "2027-11-12", availableCount: 1, price: null, stopSell: false, minStay: 1 }],
      overlappingBookings: [{ checkIn: "2027-11-10", checkOut: "2027-11-12" }],
    });
    expect(result.ok).toBe(true);
  });
});
