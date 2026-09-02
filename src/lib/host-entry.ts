/**
 * T-180 — porte « devenir hôte » cohérente.
 *
 * Avant : le footer renvoyait « Ajouter mon hébergement » vers
 * /dashboard/properties/new pour TOUS les visiteurs. Or ce segment exige le
 * rôle hôte : un voyageur connecté aboutissait, sans message, sur « / » et
 * un anonyme faisait un aller-retour /connexion → accueil. L'inscription
 * possède pourtant le sélecteur de rôle — elle n'était juste pas
 * adressable en profondeur.
 *
 * Règle (non régressive) :
 *  - hôte/admin : la destination historique du dashboard est inchangée ;
 *  - tout autre visiteur : l'inscription avec le rôle présélectionné.
 * Aucune auto-élévation de rôle n'est introduite : seule la création d'un
 * compte hôte (formulaire existant) reste la porte d'entrée — volonté de
 * modération.
 */
export function hostEntryHref(role: string | null | undefined): string {
  if (role === "host" || role === "admin") return "/dashboard/properties/new";
  return "/inscription?role=host";
}

/**
 * Pré-sélection du rôle à l'inscription via query (`?role=host`). Toute
 * autre valeur (ou absence) = voyageur, comportement historique.
 */
export function initialRoleFromSearchParam(roleParam: string | null): boolean {
  return roleParam === "host";
}
