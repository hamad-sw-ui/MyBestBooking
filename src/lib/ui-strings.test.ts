import { describe, it, expect } from "vitest";
import { uiStrings, isUiLocale } from "./ui-strings";

describe("uiStrings (T-132)", () => {
  it("fr par défaut (y compris null/undefined/arabe non supporté)", () => {
    expect(uiStrings(null)["price.from"]).toBe("Dès");
    expect(uiStrings(undefined)["price.perNight"]).toBe("/nuit");
    expect(uiStrings("ar")["book.checkIn"]).toBe("Arrivée"); // retombe en fr
  });

  it("en traduit les libellés", () => {
    expect(uiStrings("en")["price.from"]).toBe("From");
    expect(uiStrings("en")["price.perNight"]).toBe("/night");
    expect(uiStrings("en")["book.seeAvailability"]).toBe("See availability");
    expect(uiStrings("en")["fav.add"]).toBe("Add to favorites");
    expect(uiStrings("en")["home.whyReviewTitle"]).toBe("100% verified reviews");
  });

  it("isUiLocale n'accepte que fr/en", () => {
    expect(isUiLocale("fr")).toBe(true);
    expect(isUiLocale("en")).toBe(true);
    expect(isUiLocale("ar")).toBe(false);
    expect(isUiLocale(null)).toBe(false);
  });

  it("fr et en couvrent exactement les mêmes clés", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(fr)).toHaveLength(1421);
  });

  it("traduit les restes T-167 (langue, pays, auth, hero)", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    expect(fr["account.langEn"]).toBe("Anglais");
    expect(en["account.langEn"]).toBe("English");
    expect(fr["prop.country.MA"]).toBe("Maroc");
    expect(en["prop.country.MA"]).toBe("Morocco");
    expect(fr["auth.login"]).toBe("Connexion");
    expect(en["auth.login"]).toBe("Login");
    expect(fr["home.heroTitle1"]).toBe("Réservez mieux.");
    expect(en["home.heroTitle1"]).toBe("Book better.");
    expect(fr["a11y.skipToContent"]).toBe("Aller au contenu principal");
    expect(en["a11y.skipToContent"]).toBe("Skip to main content");
  });

  it("traduit facture et placeholders réglages (T-168)", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    expect(fr["inv.kindInvoice"]).toBe("FACTURE");
    expect(en["inv.kindInvoice"]).toBe("INVOICE");
    expect(fr["inv.kindReceipt"]).toMatch(/REÇU/);
    expect(en["inv.kindReceipt"]).toMatch(/RECEIPT/);
    expect(fr["settings.phBillingEmail"]).toBe("facturation@exemple.com");
    expect(en["settings.phBillingEmail"]).toBe("billing@example.com");
  });

  it("traduit le sélecteur de devise et les en-têtes CSV billing", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    expect(fr["currency.displayLabel"]).toBe("Devise d'affichage");
    expect(en["currency.displayLabel"]).toBe("Display currency");
    expect(fr["currency.storageError"]).toBe("Stockage indisponible");
    expect(en["currency.storageError"]).toBe("Local storage unavailable");
    expect(fr["billingCsv.reference"]).toBe("Référence");
    expect(en["billingCsv.reference"]).toBe("Reference");
    expect(fr["billingCsv.netToHost"]).toBe("Net hôte");
    expect(en["billingCsv.netToHost"]).toBe("Host net");
    expect(fr["billingCsv.paymentStatus"]).toBe("Statut paiement");
    expect(en["billingCsv.paymentStatus"]).toBe("Payment status");
  });
});
