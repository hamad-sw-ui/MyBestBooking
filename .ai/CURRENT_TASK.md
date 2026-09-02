# Tâche courante

- **ID** : T-192
- Titre : Hygiène documentaire factuelle (KNOWN_LIMITATIONS purgé de 7
  lignes obsolètes, chacune probe-vérifiée) + automatisation de la
  restauration sandbox (`npm run env:restore`, idempotent, testé)
- **Statut** : CORRIGÉ (VALIDÉ) ✅
- **Niveau** : **S**

## Description
Pistes « dark mode » (déjà livré T-029) et bugs ouverts (aucun) écartées
par vérification avant implémentation. Travail réel : (1) purge factuelle
de KNOWN_LIMITATIONS — seed protégé prod (probe 404/200), check-ai.mjs
20 règles, `<img>` unique volontaire (user-avatar, repli initiales),
tests stables à ordre imposé, PG 18 embarqué sans Docker, polices
Inter/Poppins en fait jamais chargées (system-ui) ; (2) restauration
sandbox automatisée — le snapshot qui purge node_modules/.data/.next/
.env.local a mordu deux fois ce jour ; `restore-env.sh` idempotent,
secrets déterministes sandbox-only (vault lisible), régénération testée
en vrai. Aucun code produit modifié.

## Sprint de fermeture (tous ✅)
- [x] probes factuels de chaque ligne purgée
- [x] `npm run env:restore` testé (sauts + régénération identique)
- [x] `npm run ci` chaîne complète VERTE (EXIT=0)
- [x] rapports + gouvernance · ai:check 20/0/0

## Précédentes tâches
- T-191 — CI reproductible `npm run ci` + workflow GHA prêt — **VALIDÉ** ✅
- T-190 — resynchronisation backlog + restauration env — **VALIDÉ** ✅
- T-189 — hygiène hooks/eslint 11→0 — **VALIDÉ** ✅

## Prochaine
- **ID** : T-193
- Ouvert : la stack (CI produit, i18n, images, hooks) est clean. Pistes
  restantes, nécessitant une décision ou un accès : (a) activer le
  workflow GHA (permission `workflows` à poser côté GitHub) ; (b)
  T-108→T-112 remédiations d'architecture (« à arbitrer », décision
  produit requise — périmètre fort : migration additive, saga
  d'annulation, DTO RSC…) ; (c) refacto `mon-compte` (390 lignes.
  lisible mais chargé) ; (d) auto-hébergement des polices si CDN
  accessible hors sandbox.
