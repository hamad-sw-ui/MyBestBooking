import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { uiStrings } from "@/lib/ui-strings";
import { HostCommissionEditor } from "./host-commission-editor";

/**
 * T-215 — rendu de la vue repliée de l'éditeur de commission hôte
 * (`/dashboard/users`). Le composant est *client* (aucun environnement
 * navigateur dans ce dépôt) : on valide donc ce que l'admin voit avant
 * d'ouvrir l'édition — le taux affiché, l'héritage du taux global et
 * l'impact annoncé. Le contrat d'écriture (`PATCH updateCommission`,
 * propagation, audits) est couvert par `src/app/api/admin/hosts/route.test.ts`.
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

function render(props: Partial<Parameters<typeof HostCommissionEditor>[0]> = {}) {
  return renderToStaticMarkup(
    <HostCommissionEditor
      userId="00000000-0000-4000-8000-000000000002"
      commissionRate={null}
      globalRate={15}
      inheritCount={0}
      explicitCount={8}
      {...props}
    />,
  );
}

describe("HostCommissionEditor (T-215)", () => {
  it("taux absent : affiche l'héritage du taux global, pas 0 %", () => {
    const html = render();
    expect(html).toContain("Hérite : 15 %");
    expect(html).not.toContain(">0 %<");
  });

  it("taux explicite : affiché tel quel (arrondi base inchangé)", () => {
    expect(render({ commissionRate: "12.50" })).toContain("12.50 %");
  });

  it("l'édition est accessible sans neutraliser le bouton à tout statut d'approbation", () => {
    const html = render();
    expect(html).toContain('aria-label="Modifier le taux de commission"');
    expect(html).not.toContain(' disabled=""');
  });

  it("le bouton reste neutralisable explicitement (prop disabled du contrat)", () => {
    expect(render({ disabled: true })).toContain(' disabled=""');
  });

  it("impact annoncé : héritent / taux explicite, exposé en infobulle", () => {
    const html = render({ inheritCount: 3, explicitCount: 5 });
    expect(html).toContain('title="Héritent : 3 · Taux explicite : 5"');
  });

  it("propagation cochable seulement s'il y a des hébergements héritant (vue ouverte)", () => {
    // Vue repliée : la case de propagation n'apparaît pas avant l'ouverture
    // de l'édition, et ne référence jamais un compte négatif.
    const html = render({ inheritCount: 0 });
    expect(html).not.toContain("Appliquer aux");
  });
});
