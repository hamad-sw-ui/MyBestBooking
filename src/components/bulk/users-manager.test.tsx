import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { uiStrings } from "@/lib/ui-strings";
import { UsersManager, type UserRow } from "./users-manager";

/**
 * T-215 — câblage de l'éditeur de commission hôte dans `/dashboard/users` :
 * présence selon le statut d'approbation et le taux (une seule zone de saisie
 * par hôte), transmission de la répartition héritage/explicite.
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

function host(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    email: "host@test.local",
    firstName: "Hélène",
    lastName: "Hôte",
    role: "host",
    country: "FR",
    emailVerified: true,
    bestrewardsLevel: null,
    bestrewardsBookingsCount: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    lastLoginAt: null,
    deletedAt: null,
    // T-230/T-231 (A10/A11) : suspension distincte + état 2FA.
    suspendedAt: null,
    twoFactorEnabled: false,
    approvalStatus: "approved",
    commissionRate: null,
    inheritCount: 0,
    explicitCount: 8,
    ...overrides,
  };
}

function render(users: UserRow[], currentUserId = "admin-id") {
  return renderToStaticMarkup(
    <UsersManager users={users} currentUserId={currentUserId} globalCommissionRate={15} />,
  );
}

describe("UsersManager — commission hôte (T-215)", () => {
  it("hôte approuvé sans taux : l'éditeur affiche l'héritage du taux global", () => {
    const html = render([host()]);
    expect(html).toContain("Hérite : 15 %");
    expect(html).toContain('aria-label="Modifier le taux de commission"');
  });

  it("hôte approuvé avec taux explicite : le taux est affiché", () => {
    const html = render([host({ commissionRate: "9.50" })]);
    expect(html).toContain("9.50 %");
  });

  it("hôte en attente sans taux : aucune zone d'édition en double (l'approbation porte le champ)", () => {
    const html = render([host({ approvalStatus: "pending", commissionRate: null })]);
    expect(html).not.toContain('aria-label="Modifier le taux de commission"');
  });

  it("hôte en attente avec taux déjà fixé : le taux reste éditable", () => {
    const html = render([host({ approvalStatus: "pending", commissionRate: "12.00" })]);
    expect(html).toContain('aria-label="Modifier le taux de commission"');
  });

  it("l'impact par hébergement est annoncé à l'admin", () => {
    const html = render([host({ inheritCount: 3, explicitCount: 5 })]);
    expect(html).toContain("Héritent : 3 · Taux explicite : 5");
  });

  it("l'admin ne peut pas modifier son propre taux (garde isSelf conservée)", () => {
    const html = render([host({ id: "admin-id" })], "admin-id");
    expect(html).toContain(' disabled=""');
  });

  it("un non-hôte n'affiche ni statut d'approbation ni éditeur", () => {
    const html = render([host({ role: "customer", approvalStatus: null, commissionRate: null })]);
    expect(html).not.toContain('aria-label="Modifier le taux de commission"');
    expect(html).not.toContain("Hérite : 15 %");
  });
});
