import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { uiStrings } from "@/lib/ui-strings";
import { DeleteAccountSection } from "./delete-account-section";

/**
 * T-262 (audit n°6, B8) — l'encart « crédit perdu » de la zone de danger.
 *
 * Le composant est client-rendu (`/mon-compte`) : ce test vérifie le contrat
 * de rendu — le montant venait de `users.wallet_balance`, il suit la devise
 * d'affichage comme la carte wallet, et il **n'apparaît pas** quand le solde
 * est nul (pas d'avertissement sans objet).
 */

const fr = uiStrings("fr");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/ui-locale-provider", () => ({
  useT: () => (key: keyof typeof fr) => fr[key],
  useUiLocale: () => "fr",
}));

// Le crochet réel interroge `/api/app-preferences` (effet) ; en rendu statique
// on fixe la devise affichée à l'euro pour vérifier le montant formaté.
vi.mock("@/lib/use-display-currency", () => ({
  useDisplayPreferences: () => ({ currency: null, language: null, ready: true }),
}));

describe("T-262 — avertissement « crédit perdu » à la suppression de compte", () => {
  it("affiche le montant du crédit gelé quand le solde est positif", () => {
    const html = renderToStaticMarkup(<DeleteAccountSection walletBalance="12.50" />);
    expect(html).toContain("sera perdu");
    expect(html).toContain("12,50");
    // Le texte du gel T-248 §3 reste exact : crédit futur, non remboursable.
    expect(html).toContain("crédit futur");
  });

  it("n'affiche rien quand il n'y a aucun crédit", () => {
    const withZero = renderToStaticMarkup(<DeleteAccountSection walletBalance="0.00" />);
    expect(withZero).not.toContain("sera perdu");
    const withoutProp = renderToStaticMarkup(<DeleteAccountSection />);
    expect(withoutProp).not.toContain("sera perdu");
  });
});
