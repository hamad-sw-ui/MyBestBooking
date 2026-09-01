import { describe, it, expect } from "vitest";
import { buildInvoiceData, invoiceFilename, renderInvoiceHtml, type InvoiceBooking, type InvoiceLegal } from "./invoice";

const legalEmpty: InvoiceLegal = {
  companyLegalName: "",
  companyLegalId: "",
  vatNumber: "",
  companyAddress: "",
  companyContactEmail: "",
  invoicePrefix: "FAC-",
  invoiceFooter: "",
};

const legalFull: InvoiceLegal = {
  ...legalEmpty,
  companyLegalName: "MyBestBooking SAS",
  companyLegalId: "123 456 789",
  vatNumber: "FR123",
};

const booking: InvoiceBooking = {
  bookingReference: "MBB-2026-ABCDEF",
  createdAt: "2026-06-01T10:00:00.000Z",
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  numNights: 2,
  numAdults: 2,
  numChildren: 1,
  guestFirstName: "Ada",
  guestLastName: "Lovelace",
  guestEmail: "ada@example.com",
  propertyName: "Riad Atlas",
  propertyCity: "Marrakech",
  propertyCountry: "MA",
  subtotal: "200",
  taxes: "20",
  fees: "10",
  discount: "5",
  total: "225",
  currency: "EUR",
  status: "confirmed",
  paymentStatus: "paid",
};

describe("invoice i18n (T-168)", () => {
  it("reçu FR par défaut (mentions légales absentes)", () => {
    const data = buildInvoiceData(booking, legalEmpty, "fr");
    const html = renderInvoiceHtml(data);
    expect(data.isInvoice).toBe(false);
    expect(html).toContain('lang="fr"');
    expect(html).toContain("REÇU / CONFIRMATION DE RÉSERVATION");
    expect(html).toContain("Voyageur");
    expect(html).toContain("Imprimer / Enregistrer en PDF");
    expect(html).toContain("Du ");
    expect(html).toContain("2 nuits");
    expect(html).toContain("2 adultes");
    expect(html).toContain("1 enfant");
    expect(html).toContain("reçu de réservation");
    expect(html).toContain("Confirmée");
    expect(html).toContain("Payé");
    expect(invoiceFilename(data)).toBe("recu-MBB-2026-ABCDEF.html");
  });

  it("facture EN quand la locale est en", () => {
    const data = buildInvoiceData(booking, legalFull, "en");
    const html = renderInvoiceHtml(data);
    expect(data.isInvoice).toBe(true);
    expect(html).toContain('lang="en"');
    expect(html).toContain("INVOICE");
    expect(html).not.toContain("FACTURE");
    expect(html).toContain("Guest");
    expect(html).toContain("Print / Save as PDF");
    expect(html).toContain("From ");
    expect(html).toContain("2 nights");
    expect(html).toContain("2 adults");
    expect(html).toContain("1 child");
    expect(html).toContain("Accommodation subtotal");
    expect(html).toContain("Confirmed");
    expect(html).toContain("Paid");
    expect(invoiceFilename(data)).toBe("invoice-MBB-2026-ABCDEF.html");
  });
});
