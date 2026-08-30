import { describe, it, expect } from "vitest";
import { cancellationPolicyLabel } from "@/lib/cancellation-label";
import { makeT } from "@/lib/ui-strings";

/**
 * T-154c (audit n°26, P2-5) — le libellé d'annulation dérive de la politique
 * réelle du bien : une politique `strict` ne doit JAMAIS produire
 * « Annulation gratuite » (avant : texte en dur dans reservation/page.tsx).
 */
describe("cancellationPolicyLabel (T-154c / audit n°26, P2-5)", () => {
  const t = makeT("fr");

  it("free → Annulation gratuite", () => {
    expect(cancellationPolicyLabel("free", t)).toBe("Annulation gratuite");
  });

  it("flexible → gratuite jusqu'à 24 h", () => {
    expect(cancellationPolicyLabel("flexible", t)).toContain("24 h");
    expect(cancellationPolicyLabel("flexible", t)).not.toBe("Annulation gratuite");
  });

  it("moderate → gratuite jusqu'à 5 jours, puis 50 %", () => {
    expect(cancellationPolicyLabel("moderate", t)).toContain("5 jours");
    expect(cancellationPolicyLabel("moderate", t)).toContain("50 %");
  });

  it("strict → n'est pas le libellé « free » (règle réelle affichée)", () => {
    const label = cancellationPolicyLabel("strict", t);
    expect(label).toContain("30 jours");
    expect(label).toContain("50 %");
    expect(label).not.toBe(cancellationPolicyLabel("free", t));
  });

  it("non_refundable → Non remboursable", () => {
    expect(cancellationPolicyLabel("non_refundable", t)).toBe("Non remboursable");
  });

  it("politique inconnue/null → règle sécurisante flexible (comme le serveur)", () => {
    expect(cancellationPolicyLabel(null, t)).toBe(cancellationPolicyLabel("flexible", t));
    expect(cancellationPolicyLabel("unknown", t)).toBe(cancellationPolicyLabel("flexible", t));
  });
});
