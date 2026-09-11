import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { uiStrings } from "@/lib/ui-strings";
import { NotificationPrefsSection } from "./notification-prefs-section";

/**
 * T-261 (audit n°6, B9) — contrat de rendu de l'écran de préférences.
 *
 * Le composant est client (`/mon-compte`) : ce test vérifie ce qui est visible —
 * les trois catégories réglables en plus des alertes prix, la note qui dit ce
 * qui reste hors de portée, et l'état « hérité » par défaut (cases cochées
 * quand `notificationPrefs` est nul, c'est-à-dire pour tous les comptes
 * existants).
 */

const fr = uiStrings("fr");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/ui-locale-provider", () => ({
  useT: () => (key: keyof typeof fr) => fr[key],
  useUiLocale: () => "fr",
}));

describe("T-261 — préférences de notification par utilisateur", () => {
  it("affiche les trois catégories réglables et la note transactionnelle", () => {
    const html = renderToStaticMarkup(
      <NotificationPrefsSection initial={{ priceAlertEnabled: true, notificationPrefs: null }} />,
    );
    expect(html).toContain("Rappels de séjour");
    // React échappe l'apostrophe dans le HTML statique.
    expect(html).toContain("Demandes d&#x27;avis");
    expect(html).toContain("Décisions de modération");
    expect(html).toContain("e-mails transactionnels");
    // Quatre interrupteurs : alertes prix + trois catégories.
    expect(html.match(/type="checkbox"/g)).toHaveLength(4);
  });

  it("reflète une catégorie coupée (case décochée) sans toucher aux autres", () => {
    const html = renderToStaticMarkup(
      <NotificationPrefsSection
        initial={{
          priceAlertEnabled: false,
          notificationPrefs: { stayReminders: false, moderationDecisions: true },
        }}
      />,
    );
    // Lecture ciblée : l'état de chaque case, par son libellé accessible.
    const inputFor = (label: string) =>
      html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
    expect(inputFor("Alertes prix favoris")).not.toContain("checked");
    expect(inputFor("Rappels de séjour")).not.toContain("checked");
    // `reviewRequests` absent = héritage → coché, comme `moderationDecisions`.
    expect(inputFor("Demandes d&#x27;avis")).toContain("checked");
    expect(inputFor("Décisions de modération")).toContain("checked");
  });
});
