import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { uiStrings } from "@/lib/ui-strings";
import { SearchNearMeButton } from "./search-near-me-button";

/**
 * T-260 (audit n°6, B7) — contrat de rendu du bouton « Autour de moi ».
 *
 * Le clic interroge `navigator.geolocation` (non testable ici en rendu
 * statique) ; ce test vérifie ce qui est visible : libellé localisé, bouton
 * `type="button"` (jamais une soumission du formulaire GET), rayon annoncé.
 * La construction d'URL, elle, est testée dans `lib/geo-distance.test.ts`.
 */

const fr = uiStrings("fr");

vi.mock("@/components/ui-locale-provider", () => ({
  useT: () => (key: keyof typeof fr) => fr[key],
  useUiLocale: () => "fr",
}));

describe("T-260 — bouton « Autour de moi »", () => {
  it("rend un bouton non-soumis avec le rayon annoncé", () => {
    const html = renderToStaticMarkup(<SearchNearMeButton />);
    expect(html).toContain("Autour de moi");
    expect(html).toContain('type="button"');
    expect(html).toContain("rayon 25 km");
    // Aucun message d'erreur avant interaction.
    expect(html).not.toContain('role="alert"');
  });
});
