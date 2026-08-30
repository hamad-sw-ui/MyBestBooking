/**
 * T-128 (audit n°8, P1) : logique pure de la garde « page de maintenance ».
 *
 * Contexte : les écritures API sont déjà bloquées (503) par
 * `assertNotMaintenance`, mais une redirection RSC `redirect("/maintenance")`
 * n'émet pas de 307 fiable sur un chargement direct de document (cf. audit 8).
 * Une garde cliente (`<MaintenanceGate/>`) s'exécute au montage, y compris sur
 * un plein-chargement, et force la navigation vers /maintenance.
 *
 * Ce module ne fait AUCUN I/O : il décide seulement si la redirection doit
 * avoir lieu, afin d'être couvert par des tests unitaires.
 */

/**
 * Chemins qui ne doivent JAMAIS forcer vers /maintenance (anti-verrouillage) :
 * l'écran de maintenance lui-même (sinon boucle), l'authentification (pour
 * qu'un admin puisse se connecter/désactiver), les assets et la santé.
 * `shouldBypassMaintenance` (src/lib/maintenance.ts) reste la référence ;
 * on en duplique ici la partie « pages » sous forme de prédicat pur pour les
 * chemins relatifs manipulés par le client (les assets /_next et /api sont
 * sans objet dans une navigation de page).
 */
const BYPASS_PATH_PREFIXES = [
  "/maintenance",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser",
  "/verifier-email",
  "/activer-compte",
];

export function isMaintenanceBypassPath(pathname: string): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/_next/") || pathname.startsWith("/uploads/")) return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return true;
  }
  return BYPASS_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Décide si la garde doit rediriger l'utilisateur vers /maintenance.
 *
 * @param active      mode maintenance actif (lu depuis /api/maintenance-status)
 * @param isAdmin     l'utilisateur courant est admin (prop injecté côté serveur)
 * @param pathname    chemin courant (window.location.pathname)
 * @returns true si l'on doit forcer la navigation vers /maintenance
 */
export function chooseMaintenanceGate(
  active: boolean,
  isAdmin: boolean,
  pathname: string,
): boolean {
  if (!active) return false;
  // Un admin doit pouvoir traverser le site pour désactiver le mode.
  if (isAdmin) return false;
  // Ne pas boucler sur /maintenance et laisser passer l'auth (anti-lockout).
  if (isMaintenanceBypassPath(pathname)) return false;
  return true;
}
