import { describe, it, expect } from "vitest";
import { bookingGuestIdentity } from "./booking-identity";

/**
 * T-157 (audit n°29) — identité d'un compte connecté lors d'une réservation.
 * Test unitaire de la fonction pure utilisée par POST /api/bookings :
 * les champs invité du payload sont ignorés pour un compte connecté ;
 * le guest mode (utilisateur null) retourne null (contrat inchangé).
 */

describe("bookingGuestIdentity (T-157)", () => {
  it("null → null (guest mode inchangé)", () => {
    expect(bookingGuestIdentity(null)).toBeNull();
  });

  it("compte → identité du compte, email normalisé en minuscules", () => {
    const id = bookingGuestIdentity({
      firstName: "Awa",
      lastName: "Nga",
      email: "Awa.Nga@Example.COM",
      phone: "+237690000000",
      country: "CM",
    });
    expect(id).toEqual({
      firstName: "Awa",
      lastName: "Nga",
      email: "awa.nga@example.com",
      phone: "+237690000000",
      country: "CM",
    });
  });

  it("compte sans téléphone ni pays → phone null, pays par défaut FR", () => {
    const id = bookingGuestIdentity({
      firstName: "Awa",
      lastName: "Nga",
      email: "awa@example.com",
      phone: null,
      country: null,
    });
    expect(id).toEqual({
      firstName: "Awa",
      lastName: "Nga",
      email: "awa@example.com",
      phone: null,
      country: "FR",
    });
  });
});
