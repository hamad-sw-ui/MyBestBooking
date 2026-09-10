/**
 * T-227 (audit n°2, A7) — fuseaux horaires réellement validés.
 *
 * Constat de l'audit : `PATCH /api/users/me` acceptait n'importe quelle chaîne
 * (`Pas/Un-Fuseau` → 200) alors que le formulaire, lui, n'offrait qu'une liste
 * fermée de 10 valeurs. Aucun module ne lisait la valeur : le réglage était
 * décoratif et incohérent.
 *
 * Ici : une seule autorité de validation (le moteur `Intl` du runtime, qui
 * connaît la base IANA complète), utilisée par le profil **et** par les
 * hébergements (`properties.timezone`, désormais exposé par l'API).
 */

/** Liste courte proposée par défaut dans les formulaires (les plus utilisés). */
export const COMMON_TIMEZONES = [
  "UTC",
  "Europe/Paris",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Berlin",
  "Africa/Douala",
  "Africa/Casablanca",
  "Africa/Tunis",
  "Africa/Dakar",
  "Africa/Abidjan",
  "America/New_York",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Kiritimati",
] as const;

/**
 * Vrai si `value` est un identifiant de fuseau reconnu par le runtime.
 * `Intl.DateTimeFormat` lève une `RangeError` pour tout identifiant inconnu.
 */
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 50) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
