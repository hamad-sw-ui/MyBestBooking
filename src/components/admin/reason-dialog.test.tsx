import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { uiStrings } from "@/lib/ui-strings";
import { ReasonDialog } from "./reason-dialog";

/**
 * T-247 (audit n°5, A3) — le motif de décision (refus, masquage, suspension)
 * se saisit dans un dialogue applicatif et non plus dans `window.prompt`.
 *
 * Le dépôt n'embarque pas d'environnement navigateur pour les composants : on
 * valide donc le rendu statique (contenu, accessibilité, garde-fou du bouton)
 * et le contrat d'écriture est couvert par les tests de route
 * (`reviews/[id]/moderate`, `users/[id]/suspend`, `properties/[id]/validate`).
 */

const fr = uiStrings("fr");
vi.mock("@/components/ui-locale-provider", () => ({
  useT: () => (key: keyof typeof fr) => fr[key],
  useUiLocale: () => "fr",
}));

function render(props: Partial<Parameters<typeof ReasonDialog>[0]> = {}) {
  return renderToStaticMarkup(
    <ReasonDialog
      open
      onClose={() => {}}
      onConfirm={() => {}}
      actionLabel="Refuser"
      {...props}
    />,
  );
}

describe("ReasonDialog (T-247)", () => {
  it("ne rend rien quand il est fermé", () => {
    expect(render({ open: false })).toBe("");
  });

  it("expose un dialogue accessible, le motif requis et le compteur", () => {
    const html = render();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="');
    expect(html).toContain("Refuser — motif");
    expect(html).toContain("Motif obligatoire");
    expect(html).toContain("0/500");
    expect(html).toContain("<textarea");
    // Le bouton d'action reste inactif tant que le motif est vide : la
    // validation serveur (motif requis) ne peut pas être contournée par l'UI.
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Refuser<\/button>/);
  });

  it("respecte maxLength et l'état occupé", () => {
    const html = render({ maxLength: 120, busy: true, error: "Motif obligatoire pour masquer ou refuser un avis" });
    expect(html).toContain("0/120");
    expect(html).toContain("maxLength=\"120\"");
    expect(html).toContain('role="alert"');
    // Les deux boutons (Annuler, action) sont désactivés pendant l'appel.
    expect(html.match(/disabled/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("personnalise le libellé d'action (suspension d'annonce)", () => {
    const html = render({ actionLabel: "Suspendre" });
    expect(html).toContain("Suspendre — motif");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Suspendre<\/button>/);
  });
});
