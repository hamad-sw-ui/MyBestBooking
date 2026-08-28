import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { isUiLocale, type UiLocale } from "@/lib/ui-strings";

/**
 * T-134 — Langue d'affichage résolue côté serveur (RSC).
 *
 * Miroir serveur de la logique client (`useDisplayPreferences`) :
 *   1. préférence `language` du compte connecté ;
 *   2. sinon langue par défaut de la plateforme (`general.defaultLanguage`) ;
 *   3. sinon "fr".
 *
 * On borne sur `UiLocale` (fr/en) car l'arabe n'a pas de dictionnaire V1 : un
 * utilisateur en "ar" retombe sur le français, comme côté client. Cette
 * fonction est utilisée par les composants/pages serveurs pour traduire les
 * libellés rendus au HTML (formulaire de recherche, en-têtes, etc.).
 */
export async function getServerLocale(): Promise<UiLocale> {
  try {
    const user = await getCurrentUser();
    if (user?.language && isUiLocale(user.language)) return user.language;
    const general = await getSetting("general");
    if (isUiLocale(general.defaultLanguage)) return general.defaultLanguage;
  } catch {
    // échec d'accès base/auth : repli français
  }
  return "fr";
}
