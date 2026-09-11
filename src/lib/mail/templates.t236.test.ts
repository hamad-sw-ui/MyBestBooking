import { describe, expect, it } from "vitest";
import { templates } from "./index";

/**
 * T-236 (audit n°3, F5) — l'heure d'arrivée estimée saisie par le voyageur
 * n'était restituée nulle part : ni sur la fiche hôte, ni dans les e-mails.
 *
 * Verrou d'affichage : la ligne apparaît quand l'heure est fournie (localisée
 * fr/en) et **disparaît** sinon — aucune ligne vide, aucun `undefined` dans le
 * message.
 */

const BASE = {
  bookingReference: "MBB-2026-T23600",
  propertyName: "Riad Jardin Secret",
  city: "Marrakech",
  checkIn: "2026-10-01",
  checkOut: "2026-10-04",
  total: "300.00",
  currency: "EUR",
};

describe("T-236 — heure d'arrivée estimée dans les e-mails", () => {
  it("demande à l'hôte : ligne affichée avec l'heure, absente sinon", () => {
    const withTime = templates.bookingRequestHost({
      hostFirstName: "Hôte",
      guestName: "Client Test",
      estimatedArrival: "15:00",
      language: "fr",
      ...BASE,
    });
    expect(withTime.text).toContain("15:00");
    expect(withTime.text).toContain("Heure d'arrivée estimée");

    const withoutTime = templates.bookingRequestHost({
      hostFirstName: "Hôte",
      guestName: "Client Test",
      language: "fr",
      ...BASE,
    });
    expect(withoutTime.text).not.toContain("Heure d'arrivée estimée");
    expect(withoutTime.text).not.toContain("undefined");
  });

  it("demande au voyageur : l'heure est reprise dans le récapitulatif", () => {
    const mail = templates.bookingRequestTraveler({
      firstName: "Client",
      estimatedArrival: "09:30",
      language: "fr",
      ...BASE,
    });
    expect(mail.text).toContain("09:30");
    expect(mail.text).toContain("Heure d'arrivée estimée");
  });

  it("confirmation : localisée en anglais", async () => {
    const mail = await templates.bookingConfirmation({
      firstName: "Guest",
      estimatedArrival: "18:30",
      language: "en",
      ...BASE,
    });
    expect(mail.text).toContain("18:30");
    expect(mail.text).toContain("Estimated arrival time");
  });

  it("notification d'hôte à la confirmation : l'heure reste visible", async () => {
    const mail = await templates.bookingHostNotification({
      hostFirstName: "Hôte",
      guestName: "Client Test",
      estimatedArrival: "18:30",
      language: "fr",
      ...BASE,
    });
    expect(mail.text).toContain("18:30");
  });
});
