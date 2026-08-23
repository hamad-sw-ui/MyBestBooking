import { describe, expect, it } from "vitest";
import { buildReservationUrl, readReservationParams } from "./reservation-url";

describe("reservation URL contract", () => {
  it("génère la convention unique et conserve le contexte de séjour", () => {
    expect(buildReservationUrl({
      propertyId: "property-id",
      roomId: "room-id",
      checkIn: "2027-01-10",
      checkOut: "2027-01-12",
      numAdults: 2,
      numChildren: 1,
    })).toBe("/reservation?property=property-id&room=room-id&checkIn=2027-01-10&checkOut=2027-01-12&adults=2&children=1");
  });

  it("lit les liens legacy sans en générer", () => {
    expect(readReservationParams(new URLSearchParams("propertyId=p&roomId=r"))).toMatchObject({
      propertyId: "p", roomId: "r", numAdults: 2, numChildren: 0,
    });
  });
});
