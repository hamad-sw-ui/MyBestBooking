# Analyse de conception — T-179 garde maintenance au proxy

- **Date** : 2026-09-01
- **Tâche** : T-179 (S)

## Alternatives envisagées

1. **Réparer le redirect dans le layout** — rejeté : le comportement avalé
   est celui du framework (le layout ne peut pas injointer la route entière
   au full-load) ; et `/` resterait hors le groupe (main) — deux trous.
2. **Déplacer `/` dans `(main)`** — rejeté : changement structurel large
   (layout, metadata, tests), hors proportion pour une garde.
3. **Garder seule la garde client `MaintenanceGate`** — rejeté : elle exige
   JS et laisse un flash de contenu complet ; le но design veut un vrai 307
   (cohérent avec T-135/T-163).
4. **Garde au proxy** (retenu) : le proxy exécute déjà chaque requête des
   pages listées (matcher T-167 complet : `/`, `/recherche`, `/hebergement`,
   protégés…) ; `getSession` y est JWT-only (lecture locale) et la sonde
   maintenance réutilise le cache 60 s de `getSetting` — coût marginal.

## Design

- Ordre dans `proxy()` : session → **maintenance** → auth pages → reste.
  En maintenance, les règles habituelles sont court-circuitées proprement
  (une route protégée mène à /maintenance, pas à /connexion).
- Redirection 307 explicite (alignée sur `redirectToLogin`).
- Découplage test : `isMaintenanceActive` moquable ; whitelist jamais
  moquée (testée en vrai) — parité test/runtime.
- Observabilité permanente : `console.info` par détournement, `console.error`
  si la sonde tombe. « Ne jamais bloquer, toujours journaliser. »

## Non-régression

- Aucun contrat d'URL, aucun clé i18n, aucune table modifiés.
- Les gardes API (503 MAINTENANCE_MODE) et la garde client (toast/replace)
  demeurent — couches complémentaires, pas substituées.
- Avec maintenance OFF : trafic identique à avant (1 lecture en cache).
