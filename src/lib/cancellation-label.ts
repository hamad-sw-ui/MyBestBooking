/**
 * T-154c (audit n°26, P2-5) — libellé utilisateur d'une politique
 * d'annulation, dérivé de `property.cancellationPolicy` (et de la grille
 * serveur `src/lib/cancellation.ts` DEFAULT_GRID) au lieu de promettre
 * « Annulation gratuite » pour tout séjour.
 *
 * Politique inconnue → libellé « flexible » (règle sécurisante serveur :
 * computeCancellationFee retombe sur flexible).
 */
import type { UiStringKey } from "@/lib/ui-strings";

export function cancellationPolicyLabel(
  policy: string | null | undefined,
  t: (key: UiStringKey) => string,
): string {
  switch (policy) {
    case "free":
      return t("book.cancel.free");
    case "flexible":
      return t("book.cancel.flexible");
    case "moderate":
      return t("book.cancel.moderate");
    case "strict":
      return t("book.cancel.strict");
    case "non_refundable":
      return t("book.cancel.nonRefundable");
    default:
      return t("book.cancel.flexible");
  }
}
