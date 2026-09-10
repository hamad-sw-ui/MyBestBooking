import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { uiStrings } from "@/lib/ui-strings";
import { BookingsManager, type BookingRow } from "./bookings-manager";

/**
 * T-216 — câblage de la colonne Statut dans `/dashboard/bookings` : le
 * composant de gestion n'est proposé que là où une transition existe, et il
 * reçoit le bon acteur (hôte propriétaire ou admin). Le comportement interne
 * de l'éditeur est couvert par `booking-status-select.test.tsx`.
 */

const fr = uiStrings("fr");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/ui-locale-provider", () => ({
  useT: () => (key: keyof typeof fr) => fr[key],
  useUiLocale: () => "fr",
}));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

function row(overrides: {
  ref: string;
  status: string;
  paymentStatus?: string | null;
  checkOut?: string;
}): BookingRow {
  return {
    booking: {
      id: `00000000-0000-4000-8000-00000000000${overrides.ref.slice(-1)}`,
      bookingReference: overrides.ref,
      status: overrides.status,
      paymentStatus: overrides.paymentStatus ?? "paid",
      checkIn: "2026-07-01",
      checkOut: overrides.checkOut ?? "2026-07-10",
      numAdults: 2,
      numChildren: null,
      guestFirstName: "Jeanne",
      guestLastName: "Dupont",
      guestEmail: "jeanne@example.com",
      total: "480.00",
      currency: "EUR",
      createdAt: "2026-06-01T10:00:00.000Z",
    },
    property: { id: "prop-1", name: "Villa Test", city: "Nice", mainImage: null },
    room: { name: "Suite", roomType: "suite" },
    user: { id: "user-1", firstName: "Jeanne", lastName: "Dupont", email: "jeanne@example.com" },
  };
}

const BOOKINGS: BookingRow[] = [
  row({ ref: "MBB-TEST-1", status: "pending", paymentStatus: "pending", checkOut: "2026-12-01" }),
  row({ ref: "MBB-TEST-2", status: "confirmed" }),
  row({ ref: "MBB-TEST-3", status: "completed" }),
  row({ ref: "MBB-TEST-4", status: "cancelled" }),
];

function render(isAdmin: boolean) {
  return renderToStaticMarkup(<BookingsManager bookings={BOOKINGS} isAdmin={isAdmin} />);
}

describe("BookingsManager — colonne Statut (T-216)", () => {
  const actions = (html: string) =>
    (html.match(/aria-label="Changer le statut —/g) ?? []).length;

  it("hôte : la gestion est offerte sur les réservations ouvertes, pas sur les états terminaux", () => {
    const html = render(false);
    // pending (future, non payée) + confirmed (payée, séjour passé) → 2 actions ;
    // completed et cancelled n'en ont aucune.
    expect(actions(html)).toBe(2);
    expect(html).toContain('aria-label="Changer le statut — MBB-TEST-1"');
    expect(html).toContain('aria-label="Changer le statut — MBB-TEST-2"');
    expect(html).not.toContain('aria-label="Changer le statut — MBB-TEST-3"');
    expect(html).not.toContain('aria-label="Changer le statut — MBB-TEST-4"');
    // Aucune colonne de sélection pour l'hôte (bulk réservé à l'admin).
    expect(html).not.toContain("bulk.selectCancellable");
  });

  it("admin : mêmes actions, plus la colonne de sélection en masse", () => {
    const html = render(true);
    expect(actions(html)).toBe(2);
    expect(html).toContain("Sélectionner");
  });

  it("les états terminaux gardent exactement le badge historique", () => {
    const html = render(false);
    // Vue repliée : aucun `<select>` de transition n'est monté avant le clic ;
    // le seul select présent est le filtre de statut de la barre d'outils.
    const selects = (html.match(/<select/g) ?? []).length;
    expect(selects).toBe(1);
    expect(html).toContain("Terminée");
    expect(html).toContain("Annulée");
  });
});
