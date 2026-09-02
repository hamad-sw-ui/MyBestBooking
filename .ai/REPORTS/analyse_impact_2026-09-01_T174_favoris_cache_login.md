# Analyse d'impact — T-174 cache favoris figé après login (famille T-173)

- **Date** : 2026-09-01
- **Tâche** : T-174
- **Niveau** : S (correctif client ciblé ; aucun contrat API)

## Problème

Suite à l'alerte utilisateur sur la fiabilité de la bascule de langue
(T-173), audit exhaustif de la même **famille de défauts** : état client en
cache de module survivant aux navigations SPA sans invalidation au
changement de session.

Trouvaille : `src/lib/use-wishlist-toggle.ts` — `cachedPayload` (promesse
module) jamais invalidé :

1. Visiteur anonyme → `GET /api/wishlists` = **401** → `cachedPayload`
   figé à `Promise(null)`.
2. Connexion (SPA, `router.push`, pas de reload).
3. Tous les cœurs de favoris restent **vides** (état lu sur l'ancien null)
   et, pire, `toggle()` lit encore le cache « anonyme » → renvoie
   `« unauthenticated »` → la carte affiche « connexion requise » alors que
   l'utilisateur **est** connecté. Persiste même après remontage des
   composants (le cache n'est pas lié au cycle de vie React) jusqu'au F5.

Audit complémentaire (négatif, voir rapport de validation) : deux seuls
caches de module clients existent ; l'autre (`use-display-currency`) est
déjà couvert par T-173 ; les layouts n'ont aucun état client stale-prone ;
`provider-credentials.ts` est un cache **serveur** à TTL 60 s (sain).

## Surface impactée

- `use-wishlist-toggle.ts` : `WISHLISTS_CHANGED_EVENT`,
  `invalidateWishlistCache()` (reset + dispatch, SSR-safe), export additif
  `resolveWishlists()`, hook ré-abonné (epoch) avec état neutre propre
  quand les listes deviennent `null`, mutations existantes re-diffusées
  (add/remove synchronisent désormais toutes les cartes du même bien).
- `login-client.tsx` / `register-client.tsx` : `invalidateWishlistCache()`
  après succès (à côté de T-173).
- `use-wishlist-toggle.test.ts` : 3 tests (null figé, invalidation →
  event + re-fetch session, SSR-safe).

## Risques & garde-fous

- Boucle d'événements : les listeners ne font que `setEpoch` → re-render ;
  aucune réémission depuis la résolution → impossible.
- Comportement anonyme inchangé (cœur → « unauthenticated » quand il faut).
- `refresh()` interne conservé, désormais diffusé (événement) — les cartes
  déjà montées d'un même bien se resynchronisent (bonus, sans changement de
  contrat du hook : `toggle` renvoie toujours `"ok" | "unauthenticated"`).

## Preuves attendues

tsc · eslint · vitest complet · build prod · smoke 94 · i18n:check ·
ai:check · probes runtime `/api/wishlists`.
