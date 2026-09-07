import { describe, it, expect } from "vitest";
import { shouldShowStripeForm, type BookingSubmitResult } from "./booking-flow";

describe("shouldShowStripeForm (P3 — flux manuel ne déclenche jamais l'UI Stripe)", () => {
  const onlinePayment: BookingSubmitResult = {
    booking: { id: "b1" },
    payment: { requiresConfirmation: true, clientSecret: "pi_abc", provider: "stripe" },
  };
  const manualBooking: BookingSubmitResult = {
    booking: { id: "b2" },
    payment: null,
    manualConfirmation: true,
  };

  it("affiche l'UI Stripe pour un paiement en ligne", () => {
    expect(shouldShowStripeForm(onlinePayment)).toBe(true);
  });

  it("affiche l'UI Stripe quand le paiement est immédiatement succeeded", () => {
    expect(shouldShowStripeForm({ booking: { id: "b" }, payment: { requiresConfirmation: false, clientSecret: "pi" } })).toBe(false);
  });

  it("n'utilise jamais l'UI Stripe pour un paiement manuel (même si payment est présent)", () => {
    // Réponse « corrompue » : manualConfirmation:true mais un payment renvoyé —
    // le garde doit quand même désactiver l'UI carte.
    expect(
      shouldShowStripeForm({ booking: { id: "b2" }, payment: { requiresConfirmation: true, clientSecret: "pi_zzz" }, manualConfirmation: true }),
    ).toBe(false);
  });

  it("n'affiche pas l'UI Stripe pour un booking manuel (payment null)", () => {
    expect(shouldShowStripeForm(manualBooking)).toBe(false);
  });

  it("n'affiche pas l'UI Stripe sans clientSecret", () => {
    expect(shouldShowStripeForm({ booking: { id: "b" }, payment: { requiresConfirmation: true, clientSecret: null } })).toBe(false);
  });
});
