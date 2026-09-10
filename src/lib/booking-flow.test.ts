import { describe, it, expect } from "vitest";
import { shouldShowStripeForm, type BookingSubmitResult } from "./booking-flow";

describe("shouldShowStripeForm (T-207 — aucun paiement plateforme)", () => {
  const legacyOnlinePayment: BookingSubmitResult = {
    booking: { id: "b1" },
    payment: { requiresConfirmation: true, clientSecret: "pi_abc", provider: "stripe" },
  };
  const manualBooking: BookingSubmitResult = {
    booking: { id: "b2" },
    payment: null,
    manualConfirmation: true,
  };

  it("n'affiche plus l'UI Stripe même si une réponse legacy contient un clientSecret", () => {
    expect(shouldShowStripeForm(legacyOnlinePayment)).toBe(false);
  });

  it("n'affiche pas l'UI Stripe pour un booking manuel", () => {
    expect(shouldShowStripeForm(manualBooking)).toBe(false);
  });

  it("n'affiche pas l'UI Stripe pour une réponse explicitement désactivée", () => {
    expect(shouldShowStripeForm({ booking: { id: "b" }, onlinePaymentDisabled: true })).toBe(false);
  });
});
