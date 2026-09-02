import { describe, it, expect } from "vitest";
import { localizeApiMessage } from "./api-error";

describe("localizeApiMessage (T-168 / T-169)", () => {
  it("conserve le français par défaut", () => {
    expect(localizeApiMessage("Non autorisé", "fr")).toBe("Non autorisé");
    expect(localizeApiMessage("Non autorisé", null)).toBe("Non autorisé");
    expect(localizeApiMessage("Identifiant invalide", undefined)).toBe("Identifiant invalide");
  });

  it("traduit les erreurs connues en anglais", () => {
    expect(localizeApiMessage("Non autorisé", "en")).toBe("Unauthorized");
    expect(localizeApiMessage("Identifiant invalide", "en")).toBe("Invalid identifier");
    expect(localizeApiMessage("Valeur trop petite", "en")).toBe("Value too small");
    expect(localizeApiMessage("Adresse email invalide", "en")).toBe("Invalid email address");
  });

  it("traduit les préfixes Code promo / Wallet et le reste interpolé", () => {
    expect(localizeApiMessage("Code promo : Code inactif", "en")).toBe("Promo code: Inactive code");
    expect(localizeApiMessage("Code promo : Réservation minimum 100.00", "en")).toBe(
      "Promo code: Minimum booking 100.00",
    );
    expect(
      localizeApiMessage("Wallet : Devise non supportée pour l'application du wallet : USD", "en"),
    ).toBe("Wallet: Unsupported currency for wallet application: USD");
    expect(localizeApiMessage("Cette chambre accepte au maximum 2 adultes", "en")).toBe(
      "This room accepts a maximum of 2 adults",
    );
    expect(localizeApiMessage("Cette chambre accepte au maximum 1 enfant", "en")).toBe(
      "This room accepts a maximum of 1 child",
    );
    expect(localizeApiMessage("Cet hébergement exige un séjour minimum de 3 nuits", "en")).toBe(
      "This property requires a minimum stay of 3 nights",
    );
    expect(localizeApiMessage("Le paramètre minPrice doit être un nombre positif", "en")).toBe(
      "The minPrice parameter must be a positive number",
    );
    expect(localizeApiMessage("Champ non autorisé : secretKey", "en")).toBe(
      "Unauthorized field: secretKey",
    );
    expect(localizeApiMessage("Test stripe échoué : AUTH_FAILED", "en")).toBe(
      "stripe test failed: AUTH_FAILED",
    );
    expect(localizeApiMessage("Fichier trop volumineux (6.12 MB > 5 MB)", "en")).toBe(
      "File too large (6.12 MB > 5 MB)",
    );
    expect(localizeApiMessage("Connexion stripe validée", "en")).toBe("stripe connection validated");
    expect(localizeApiMessage("Transition invalide : pending → completed", "en")).toBe(
      "Invalid transition: pending → completed",
    );
    expect(localizeApiMessage("2 réservation(s) future(s) — impossible de supprimer", "en")).toBe(
      "2 future booking(s) — cannot delete",
    );
    expect(localizeApiMessage("user introuvable", "en")).toBe("user not found");
    expect(localizeApiMessage("Inscription réussie", "en")).toBe("Sign-up successful");
  });

  it("traduit la validation chambre et les tests providers", () => {
    expect(localizeApiMessage("Le prix de base doit être strictement positif", "en")).toBe(
      "The base price must be strictly positive",
    );
    expect(
      localizeApiMessage("Le nombre d'adultes ne peut pas dépasser la capacité maximale", "en"),
    ).toBe("The number of adults cannot exceed the maximum capacity");
    expect(
      localizeApiMessage("Adultes + enfants ne peuvent pas dépasser la capacité maximale", "en"),
    ).toBe("Adults + children cannot exceed the maximum capacity");
    expect(localizeApiMessage("La quantité ne peut pas dépasser 50", "en")).toBe(
      "The quantity cannot exceed 50",
    );
    expect(localizeApiMessage("Stripe n'est pas complètement configuré", "en")).toBe(
      "Stripe is not fully configured",
    );
    expect(localizeApiMessage("Stripe a refusé l'annulation de l'intent de test", "en")).toBe(
      "Stripe refused to cancel the test intent",
    );
    expect(localizeApiMessage("Resend n'est pas configuré", "en")).toBe("Resend is not configured");
    expect(localizeApiMessage("S3/R2 n'est pas complètement configuré", "en")).toBe(
      "S3/R2 is not fully configured",
    );
    expect(localizeApiMessage("Objet test S3 créé mais non supprimé", "en")).toBe(
      "Test S3 object was created but not deleted",
    );
  });

  it("laisse intact un message hors dictionnaire", () => {
    expect(localizeApiMessage("Custom upstream", "en")).toBe("Custom upstream");
  });
});
