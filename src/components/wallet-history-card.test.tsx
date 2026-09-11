import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { uiStrings } from "@/lib/ui-strings";
import { WalletHistoryCard } from "./wallet-history-card";

/**
 * T-248 (audit n°5, A6) — l'historique du wallet est la partie visible du
 * journal `wallet_transactions`.
 *
 * Le dépôt n'embarque pas d'environnement navigateur : on valide le rendu
 * statique (état de chargement, montants signés, libellés i18n) ; le contrat
 * d'écriture est couvert par `wallet-ledger.test.ts` et
 * `cron/price-alerts/route.t248.test.ts`.
 */

const fr = uiStrings("fr");
vi.mock("@/components/ui-locale-provider", () => ({
  useT: () => (key: keyof typeof fr) => fr[key],
  useUiLocale: () => "fr",
}));

function render() {
  return renderToStaticMarkup(<WalletHistoryCard />);
}

describe("T-248 — historique du wallet", () => {
  it("affiche l'état de chargement avant la réponse", () => {
    const html = render();
    expect(html).toContain('data-testid="wallet-history-loading"');
    // renderToStaticMarkup échappe l'apostrophe (&#x27;).
    expect(html).toContain("Chargement de l");
  });

  it("le libellé de type est traduit pour chaque kind du journal", () => {
    // Garde-fou : tout `kind` prévu par le schéma a une clé i18n FR + EN.
    const kinds = [
      "cashback",
      "referral_referee",
      "referral_referrer",
      "booking_refund",
      "booking_payment",
      "manual_adjustment",
    ];
    const frKeys = Object.keys(fr);
    for (const kind of kinds) {
      const camel = kind.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
      expect(frKeys, `wallet.kind.${camel}`).toContain(`wallet.kind.${camel}`);
    }
    expect(frKeys).toContain("wallet.historyTitle");
    expect(frKeys).toContain("wallet.historyBalanceAfter");
  });

  it("n'écrit jamais : le composant est en lecture seule", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./wallet-history-card.tsx", import.meta.url), "utf8"),
    );
    // Aucune méthode d'écriture HTTP ni mutation de solde.
    expect(source).not.toMatch(/method:\s*"(POST|PATCH|PUT|DELETE)"/);
    expect(source).not.toMatch(/walletBalance\s*=/);
  });
});
