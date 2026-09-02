# Analyse de conception — T-173 invalidation réactive des préférences

- **Date** : 2026-09-01
- **Tâche** : T-173 (S)

## Options envisagées

1. **Rechargement complet après login/register**
   (`window.location.assign`) — garanti mais brutal : perte de l'état SPA,
   latence, et changerait le comportement de monstres validés (safe-next,
   2FA step) → rejeté (risque de régression).
2. **Propagation par contexte racine re-monté** — impossible sans plein
   rechargement : le layout racine survit à la navigation SPA.
3. **Store réactif minimal** (retenu) : événement `window`
   `mybb:display-preferences-changed` + invalidation du cache module ;
   chaque `useDisplayPreferences` monté rejoue la résolution et se met à
   jour. Additif, testable sans DOM complet (stubs), SSR-safe.

## Design

- `invalidateDisplayPreferences()` = `cached = null` + `dispatchEvent`.
  Point d'entrée unique, appelé après login et register (les deux
  transitions anonyme→compte). Logout : non concerné (`<form method=POST>`
  → plein rechargement, vérifié).
- Le hook consolide : un seul `useEffect` qui charge au montage **et** se
  réabonne à l'événement ; cleanup propre (cancelled + removeEventListener).
- Rollback du sélecteur : sur échec PATCH, `setLocal(null)` +
  réécriture de l'ancienne valeur dans localStorage/cookies
  (`persistUiLanguageClient(value)`).
- Test : stubs `window`/`fetch` — prouve (a) dédup du cache, (b) event
  dispatché + re-résolution = nouvelles requêtes (scénario exact du bug :
  anonyme « en » caché → compte « fr » relu), (c) no-throw sans window.

## Non-régression

- Aucun changement de priorité de résolution (compte > localStorage/cookie
  > plateforme > fr).
- Aucun changement d'API, de cookie, de DOM rendu hors mise à jour réactive.
- `resetDisplayPreferencesCache()` : signature et appelants inchangés.
