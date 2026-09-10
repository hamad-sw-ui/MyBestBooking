/**
 * T-232 (audit n°3, F1/F9/F10) — une seule autorité pour les dates.
 *
 * Constat d'audit : le même séjour s'affichait « 24 septembre » sur un serveur en
 * UTC et **« 23 septembre »** côté navigateur à Los Angeles. Deux causes :
 *
 *  1. `pg` parse une colonne `date` en `Date` JS à **minuit local du serveur** :
 *     `2026-09-24` devenait `2026-09-23T23:00Z` sous `TZ=Africa/Douala`, puis
 *     `2026-09-24T07:00Z` sous `TZ=America/Los_Angeles`. Toute comparaison
 *     métier (`toDate()`, éligibilité d'un avis) devenait dépendante du fuseau de
 *     l'instance — et le rendu SSR différait du rendu client.
 *  2. `formatDate()` formatait sans `timeZone` : un instant, quel qu'il soit,
 *     était rendu dans le fuseau du runtime appelant.
 *
 * Règle posée ici, sans exception :
 *
 *  - une **date civile** (`check_in`, `check_out`, jours de calendrier) est une
 *    chaîne `YYYY-MM-DD` et s'affiche **toujours en UTC** : le jour ne bouge
 *    jamais, où que soit le lecteur ;
 *  - un **instant** (horodatage technique) s'affiche dans un fuseau **explicite**
 *    — celui de l'utilisateur s'il est connu, UTC par défaut. Jamais celui du
 *    runtime, qui n'est pas une propriété du produit.
 *
 * Module pur (aucun import serveur) : utilisable côté client comme côté serveur.
 */

/** Identifiant de fuseau par défaut quand aucun n'est connu. */
export const DEFAULT_TIME_ZONE = "UTC";

/** `YYYY-MM-DD` seul (date civile, sans heure ni fuseau). */
const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalise une valeur en date civile `YYYY-MM-DD`.
 *
 * Accepte les chaînes (`2026-09-24`, `2026-09-24T00:00:00.000Z`, ISO complet) et
 * les `Date` (converties par leurs **composantes UTC**, jamais locales : une
 * colonne `date` lue à minuit local ne doit pas reculer d'un jour).
 * Retourne `null` pour toute entrée inexploitable — l'appelant décide du repli.
 */
export function toCivilDate(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (CIVIL_DATE_RE.test(trimmed)) return trimmed;
    // ISO complet (`2026-09-24T23:00:00.000Z`) : la date civile est la partie
    // date, mais si l'instant porte une heure, on ne peut PAS la prendre telle
    // quelle sans risquer un décalage — on lit alors la date en UTC.
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return civilDateOf(parsed, DEFAULT_TIME_ZONE);
  }
  if (Number.isNaN(value.getTime())) return null;
  return civilDateOf(value, DEFAULT_TIME_ZONE);
}

/** Date civile (`YYYY-MM-DD`) d'un instant, dans un fuseau IANA donné. */
export function civilDateOf(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  // `en-CA` produit directement `YYYY-MM-DD` ; on évite toute manipulation de
  // composantes locales (`getFullYear()` & co) qui dépendrait du runtime.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * « Aujourd'hui » métier, exprimé comme date civile dans un fuseau explicite.
 *
 * Remplace `new Date().toISOString().slice(0, 10)` : l'horizon d'une règle
 * métier (séjour passé, échéance, fenêtre de calendrier) doit être décidable et
 * reproductible, pas dépendant du fuseau de l'instance qui exécute le code.
 */
export function civilToday(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  return civilDateOf(now, timeZone);
}

/** Date civile décalée de `days` jours (`-1` = hier). */
export function addCivilDays(civilDate: string, days: number): string {
  const [y, m, d] = civilDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** Nombre de jours civils entre deux dates (`b - a`). */
export function civilDaysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export interface CivilFormatOptions extends Intl.DateTimeFormatOptions {
  /** Fuseau d'affichage — ignoré pour une date civile (toujours UTC). */
  timeZone?: string;
}

/**
 * Formate une **date civile** pour un humain, sans jamais décaler le jour.
 *
 * `formatCivilDate("2026-09-24")` → « 24 septembre 2026 » en français, quel que
 * soit le fuseau du serveur ou du navigateur.
 */
export function formatCivilDate(
  value: string | Date | null | undefined,
  options: CivilFormatOptions = {},
  locale: string = "fr-FR",
): string {
  const civil = toCivilDate(value);
  if (!civil) return "—";
  // La chaîne est interprétée comme minuit **UTC** et rendue en UTC : le jour
  // civil affiché est exactement celui fourni.
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${civil}T00:00:00.000Z`));
}

/**
 * Formate un **instant** (horodatage) dans un fuseau explicite.
 * `timeZone` absent → UTC (jamais le fuseau du runtime, qui ferait diverger le
 * rendu serveur et le rendu client du même composant).
 */
export function formatTimestamp(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions & { timeZone?: string } = {},
  locale: string = "fr-FR",
): string {
  if (value === null || value === undefined) return "—";
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return "—";
  const { timeZone = DEFAULT_TIME_ZONE, ...rest } = options;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...rest,
    timeZone,
  }).format(instant);
}

/**
 * Alias local de `intlLocale` — dupliqué volontairement (module pur) : `dates.ts`
 * ne doit dépendre d'aucun module qui tire une dépendance serveur, faute de quoi
 * il deviendrait inutilisable dans un composant client.
 */
function intlLocale(locale: string | null | undefined): string {
  // Même correspondance que `src/lib/utils.ts` (en-GB / fr-FR) pour que les
  // dates et les montants d'une même page ne divergent pas.
  return (locale ?? "").toLowerCase().startsWith("en") ? "en-GB" : "fr-FR";
}
