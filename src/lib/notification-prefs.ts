/**
 * T-261 (audit n°6, B9) — préférences de notification **par utilisateur**.
 *
 * Constat d'exécution : l'écran « Préférences de notification » de `/mon-compte`
 * n'exposait que les alertes prix ; les onze autres interrupteurs sont des
 * réglages **globaux** d'administration (`app_settings.notifications`). Un
 * voyageur ne pouvait donc pas arrêter ses rappels de séjour ou ses demandes
 * d'avis : il ne pouvait que subir, ou signaler les e-mails en spam.
 *
 * Conception retenue (non régressive) :
 *  - la préférence est stockée dans `users.notification_prefs` (jsonb, **nullable**) ;
 *  - `null` / clé absente ⇒ **héritage du réglage global** : tant que personne ne
 *    touche à l'écran, le comportement d'envoi est exactement celui d'avant ;
 *  - l'interrupteur **admin reste maître** : un utilisateur ne peut que
 *    *restreindre* (`false`), jamais réactiver ce que l'équipe a coupé ;
 *  - seules les catégories « confort » sont réglables (rappels de séjour,
 *    demandes d'avis, décisions de modération) ; les e-mails transactionnels
 *    (bienvenue/vérification, confirmation, expiration, relance de règlement,
 *    sécurité) restent hors de portée de l'utilisateur ;
 *  - les alertes prix gardent leur réglage dédié (`users.priceAlertEnabled`).
 */

/** Catégories qu'un utilisateur peut couper. */
export const USER_NOTIFICATION_CATEGORIES = [
  "stayReminders",
  "reviewRequests",
  "moderationDecisions",
] as const;

export type UserNotificationCategory = (typeof USER_NOTIFICATION_CATEGORIES)[number];

/** Préférences d'un utilisateur : absent = héritage, `false` = coupé. */
export type UserNotificationPrefs = Partial<Record<UserNotificationCategory, boolean>>;

/**
 * Clés de `app_settings.notifications` (réglages admin) rattachées à chaque
 * catégorie. Les clés absentes de cette table — donc non réglables par
 * l'utilisateur — suivent uniquement le global.
 */
const CATEGORY_SETTING_KEYS: Record<UserNotificationCategory, readonly string[]> = {
  stayReminders: ["bookingReminderJ3", "bookingReminderJ1"],
  reviewRequests: ["reviewRequest"],
  // Décisions rendues par l'équipe : modération d'avis (auteur) et validation
  // d'annonce (hôte) — même nature pour l'utilisateur qui les reçoit.
  moderationDecisions: ["reviewModerated", "propertyApproved", "propertyRejected"],
};

/** Catégorie à laquelle appartient une clé de réglage global, ou `null`. */
export function categoryForNotificationKey(key: string): UserNotificationCategory | null {
  for (const category of USER_NOTIFICATION_CATEGORIES) {
    if (CATEGORY_SETTING_KEYS[category].includes(key)) return category;
  }
  return null;
}

/**
 * Lit la colonne jsonb **sans jamais lever** : une valeur illisible (jsonb
 * inattendu, chaîne d'une ancienne version, objet exotique) est traitée comme
 * « aucun réglage » — donc héritage du global, exactement le comportement
 * historique. Seules les clés booléennes connues sont retenues.
 */
export function parseUserNotificationPrefs(raw: unknown): UserNotificationPrefs | null {
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const parsed: UserNotificationPrefs = {};
  for (const category of USER_NOTIFICATION_CATEGORIES) {
    const entry = (value as Record<string, unknown>)[category];
    if (typeof entry === "boolean") parsed[category] = entry;
  }
  return Object.keys(parsed).length > 0 ? parsed : null;
}

/** L'utilisateur a-t-il explicitement coupé cette catégorie ? */
export function isCategoryDisabled(prefs: unknown, category: UserNotificationCategory): boolean {
  return parseUserNotificationPrefs(prefs)?.[category] === false;
}

/**
 * Interrupteur final d'un envoi :
 * `false` global ⇒ jamais d'envoi (l'équipe reste maître) ;
 * sinon la préférence utilisateur peut seulement couper (`false`).
 */
export function enabledFor(prefs: unknown, key: string, globalEnabled: boolean): boolean {
  if (!globalEnabled) return false;
  const category = categoryForNotificationKey(key);
  if (!category) return true;
  return parseUserNotificationPrefs(prefs)?.[category] !== false;
}
