import "server-only";

import { getSetting } from "@/lib/settings";
import { isDisplayCurrency, normalizeDisplayCurrency, type DisplayCurrency } from "@/lib/i18n";

/**
 * Résout la devise d'affichage pour un rendu serveur avec le même contrat que
 * `useDisplayPreferences`: compte > catalogue activé > défaut plateforme.
 * Une devise native de transaction n'est jamais passée à cette fonction pour
 * être persistée ou débitée ; elle sert uniquement à préparer un affichage.
 */
export async function getServerDisplayCurrency(
  userCurrency: string | null | undefined,
): Promise<DisplayCurrency> {
  try {
    const general = await getSetting("general");
    const supported = general.supportedCurrencies.filter(isDisplayCurrency);
    const fallback = normalizeDisplayCurrency(
      supported.includes(general.defaultCurrency) ? general.defaultCurrency : supported[0],
      "XAF",
    );
    const normalizedUser = userCurrency?.trim().toUpperCase();
    if (normalizedUser && supported.includes(normalizedUser as DisplayCurrency)) {
      return normalizedUser as DisplayCurrency;
    }
    return fallback;
  } catch {
    return normalizeDisplayCurrency(userCurrency, "XAF");
  }
}
