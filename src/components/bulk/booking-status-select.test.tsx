import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "@/components/ui/badge";
import { uiStrings } from "@/lib/ui-strings";
import { BookingStatusSelect } from "./booking-status-select";

/**
 * T-216 — politique de rendu de la colonne Statut de `/dashboard/bookings`.
 *
 * Le composant est *client* : sans DOM (aucun environnement navigateur n'est
 * installé dans ce dépôt), on vérifie ici le **rendu serveur de la vue
 * repliée** : badge seul ou badge + accès à la gestion manuelle. La liste des
 * transitions réellement proposables est couverte par
 * `src/lib/booking-lifecycle.test.ts` (`availableTransitions`), et l'effet
 * réseau par `src/app/api/bookings/[id]/route.t213.test.ts` (vrais `PUT`).
 *
 * `next/navigation`, le dictionnaire i18n et le toast sont mockés : aucun
 * provider Next n'est monté dans un test node.
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

const badge = <Badge className="bg-green-100 text-green-800">Confirmée</Badge>;

function render(props: Partial<Parameters<typeof BookingStatusSelect>[0]> = {}) {
  return renderToStaticMarkup(
    <BookingStatusSelect
      bookingId="00000000-0000-4000-8000-000000000001"
      bookingReference="MBB-2026-TEST01"
      status="confirmed"
      paymentStatus="paid"
      checkOut="2026-08-01"
      actor="host"
      badge={badge}
      {...props}
    />,
  );
}

describe("BookingStatusSelect (T-216)", () => {
  it("hôte, séjour payé et passé : badge + accès à la gestion manuelle", () => {
    const html = render();
    expect(html).toContain("Confirmée");
    expect(html).toContain("Changer le statut");
    expect(html).toContain("aria-label=\"Changer le statut — MBB-2026-TEST01\"");
  });

  it("demande en attente : l'hôte peut la confirmer depuis la liste", () => {
    const html = render({ status: "pending", paymentStatus: "pending", checkOut: "2026-12-01" });
    expect(html).toContain("Changer le statut");
  });

  it("admin : mêmes droits que l'hôte propriétaire", () => {
    const html = render({ actor: "admin", status: "pending", paymentStatus: "pending" });
    expect(html).toContain("Changer le statut");
  });

  it("séjour payé mais non commencé : l'annulation reste accessible", () => {
    const html = render({ status: "confirmed", paymentStatus: "paid", checkOut: "2027-01-01" });
    expect(html).toContain("Changer le statut");
  });

  it("séjour non payé : l'annulation reste possible (la clôture, elle, est masquée par availableTransitions)", () => {
    const html = render({ status: "confirmed", paymentStatus: "pending", checkOut: "2026-08-01" });
    expect(html).toContain("Changer le statut");
  });

  it("états terminaux : badge seul, aucune action — le hint est exposé en repli", () => {
    for (const terminal of ["completed", "cancelled", "no_show"]) {
      const html = render({
        status: terminal,
        paymentStatus: "paid",
        checkOut: "2026-08-01",
        disabledHint: "Aucune transition",
      });
      expect(html).not.toContain("Changer le statut");
      expect(html).toContain("Confirmée");
      expect(html).toContain('title="Aucune transition"');
    }
  });
});
