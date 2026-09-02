# Analyse de conception — T-174 invalidation réactive du cache favoris

- **Date** : 2026-09-01
- **Tâche** : T-174 (S)

## Problème

Le cœur de favori lisait `GET /api/wishlists` via une promesse cachée au
niveau module (`cachedPayload`), invalidée uniquement après une mutation
add/remove — jamais au changement de session. Après login SPA :
`null` périmé (401 anonyme) → cœurs faux et `toggle()` « unauthenticated ».

## Design retenu (miroir T-173, éprouvé la même session)

1. **Canal dédié** `WISHLISTS_CHANGED_EVENT` (sémantique distincte de
   `DISPLAY_PREFS_EVENT` : les deux états ont des cycles de vie propres —
   pas de couplage artificiel).
2. `invalidateWishlistCache()` = reset + dispatch, SSR-safe
   (`typeof window` guard, testé).
3. Hook `useWishlistToggle` :
   - un `epoch` d'état incrémenté à l'événement, ajouté aux deps de
     l'effet de résolution → re-lecture du cache (frais) à chaque
     invalidation, pour **tous les cœurs montés** ;
   - résolution `null` → état neutre explicite (`saved=false`,
     `wishlistId=null`) au lieu de conserver une valeur périmée.
4. Mutations : `refresh()` interne délègue à `invalidateWishlistCache()` →
   diffusion à toutes les cartes du même bien (cohérence multi-cartes,
   sans changement de contrat).
5. Points d'appel : après login et register, aux côtés de
   `invalidateDisplayPreferences()` (T-173). Logout : plein rechargement
   (form POST) → rien à faire.

## Alternatives écartées

- **Un seul canal « session-changed » mutualisé** : séduisant mais couplage
  fort (toute mutation d'une ressource invaliderait l'autre) et re-fetch
  inutile de `/api/auth/me` à chaque cœur cliqué → rejeté.
- **Supprimer le cache** (fetch par carte) : régression réseau (1 requête
  par carte visible) → rejeté.
- **Rechargement complet après login** : cf. T-173, rejeté (état SPA perdu).

## Non-régression

Contrat du hook inchangé (`toggle(): "ok" | "unauthenticated"`), comportement
anonyme conservé, dédup requêtes conservé (1 fetch par résolution), aucune
API/DB touchée.
