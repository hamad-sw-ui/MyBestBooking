import { describe, expect, it } from "vitest";
import { buildReservationUrl, readReservationParams, describeIncompleteLink } from "./reservation-url";

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

describe("describeIncompleteLink (T-176)", () => {
  it("lien complet → aucun rattrapage nécessaire", () => {
    expect(describeIncompleteLink(new URLSearchParams("property=p&room=r"))).toBeNull();
  });
  it("reprise de paiement → le tunnel booking= ne doit jamais être détourné", () => {
    expect(describeIncompleteLink(new URLSearchParams("booking=b123"))).toBeNull();
    expect(describeIncompleteLink(new URLSearchParams("booking=b123&room=r"))).toBeNull();
  });
  it("chambre seule → résolution roomOnly (nouvelle clé et legacy)", () => {
    expect(describeIncompleteLink(new URLSearchParams("room=ch1"))).toEqual({ kind: "roomOnly", roomId: "ch1" });
    expect(describeIncompleteLink(new URLSearchParams("roomId=ch2"))).toEqual({ kind: "roomOnly", roomId: "ch2" });
  });
  it("propriété seule → redirection propertyOnly (nouvelle clé et legacy)", () => {
    expect(describeIncompleteLink(new URLSearchParams("property=pr1"))).toEqual({ kind: "propertyOnly", propertyId: "pr1" });
    expect(describeIncompleteLink(new URLSearchParams("propertyId=pr2"))).toEqual({ kind: "propertyOnly", propertyId: "pr2" });
  });
  it("lien sans aucun paramètre exploitable → état actuel conservé", () => {
    expect(describeIncompleteLink(new URLSearchParams(""))).toBeNull();
    expect(describeIncompleteLink(new URLSearchParams("adults=2&checkIn=2027-01-10"))).toBeNull();
  });
});

