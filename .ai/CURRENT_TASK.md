# 🎯 TÂCHE EN COURS

**Tâche :** Corriger les risques P0 post-T109 : injection JSON-LD, crash
refund, consommation token concurrente et promesses/promo non supportées.
**ID** : T-110
**Niveau** : **S** — sécurité contenu public et intégrité financière.
**Statut** : **CORRIGÉ (VALIDÉ)**

## Périmètre

- sérialisation JSON-LD script-safe ;
- annulation persistée avant PSP et reprise refund ;
- token claim/reset atomique ;
- retrait/reformulation des promesses et `free_night` approximatif.

## Sortie obligatoire

Tests XSS/refund/token/promo, typecheck, lint, tests, build, smoke et ai:check.
