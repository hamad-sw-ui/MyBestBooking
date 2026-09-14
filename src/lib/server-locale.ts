import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { isUiLocale, type UiLocale } from "@/lib/ui-strings";
import { UI_LANGUAGE_COOKIE, UI_LANGUAGE_COOKIE_ALT } from "@/lib/ui-language";

/**
 * T-134 — Langue d'affichage résolue côté serveur (RSC).
 *
 * Miroir serveur de la logique client (`useDisplayPreferences`) :
 *   1. préférence `language` du compte connecté ;
 *   2. sinon header `x-ui-language` (proxy : `?lang=` / cookie) ;
 *   3. sinon cookie `mybb:ui-language` / `mybb-ui-language` ;
 *   4. sinon langue par défaut de la plateforme (`general.defaultLanguage`) ;
 *   5. sinon "fr".
 *
 * Chaque étape a son propre try : un échec auth ne doit pas empêcher
 * la lecture du cookie anonyme.
 */
/**
 * PERF-003 — mémoïsé par requête (`React.cache`). La fonction est appelée par
 * le layout, la page **et** `generateMetadata` ; sans mémoïsation, chaque appel
 * relançait la résolution complète (dont `getCurrentUser` et un
 * `getSetting("general")`). Le résultat est identique : la langue résolue ne
 * dépend que de la requête en cours.
 */
export const getServerLocale = cache(async function getServerLocale(): Promise<UiLocale> {
  try {
    const user = await getCurrentUser();
    if (user?.language && isUiLocale(user.language)) return user.language;
  } catch {
    // auth/DB indisponible : on continue avec le cookie
  }
  try {
    const hdr = (await headers()).get("x-ui-language");
    if (hdr && isUiLocale(hdr)) return hdr;
  } catch {
    // hors requête
  }
  try {
    const jar = await cookies();
    const cookieLang =
      jar.get(UI_LANGUAGE_COOKIE)?.value ?? jar.get(UI_LANGUAGE_COOKIE_ALT)?.value;
    if (cookieLang && isUiLocale(cookieLang)) return cookieLang;
  } catch {
    // cookies() hors requête : étape suivante
  }
  try {
    const general = await getSetting("general");
    if (isUiLocale(general.defaultLanguage)) return general.defaultLanguage;
  } catch {
    // échec settings
  }
  return "fr";
});
