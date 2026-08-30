import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { isUiLocale, type UiLocale } from "@/lib/ui-strings";

/**
 * T-134 — Langue d'affichage résolue côté serveur (RSC).
 *
 * Miroir serveur de la logique client (`useDisplayPreferences`) :
 *   1. préférence `language` du compte connecté ;
 *   2. sinon cookie `mybb:ui-language` posé par le sélecteur/init client
 *      (T-158 : les visiteurs anonymes qui ont choisi l'anglais gardent
 *      leur langue lors des navigations serveur — métadonnées, SSR) ;
 *   3. sinon langue par défaut de la plateforme (`general.defaultLanguage`) ;
 *   4. sinon "fr".
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
    // T-158 (audit n°29) : préférence locale anonyme (posée par le script
    // d'init <html lang> + sélecteur de langue, même clé que le localStorage).
    const cookieLang = (await cookies()).get("mybb:ui-language")?.value;
    if (cookieLang && isUiLocale(cookieLang)) return cookieLang;
    const general = await getSetting("general");
    if (isUiLocale(general.defaultLanguage)) return general.defaultLanguage;
  } catch {
    // échec d'accès base/auth : repli français
  }
  return "fr";
}
