# Tâche courante

- **ID** : T-194
- Titre : Accès démo en un clic — les 3 boutons (Admin/Hébergeur/Client)
  connectent via le flux de login normal (demande utilisateur) ; i18n fr/en ;
  assertion smoke dédiée (95)
- **Statut** : CORRIGÉ (VALIDÉ) ✅
- **Niveau** : **S**

## Description
Le diagnostic montrait que les identifiants démo fonctionnaient (API 200×3)
mais n'étaient que du texte à copier-coller. Le bloc est devenu 3 boutons
actionnables partageant `loginWith()` avec le formulaire (mêmes
invalidations T-173/T-174, MÊME redirection). Aucun chemin API spécial.
Clé `auth.demoHint` fr/en ; verrou compteur ui-strings 1421→1422 ; smoke
94→95.

## Sprint de fermeture (tous ✅)
- [x] probes : SSR boutons FR/EN ; API login ×3 → 200
- [x] tsc/eslint/i18n 0 · vitest 484/484 · smoke 95/95 · build ✓
- [x] npm run ci EXIT=0 · rapports + gouvernance · ai:check 20/0/0

## Précédentes tâches
- T-193 — `npm run site:audit` (audit runtime, 0 issue) — **VALIDÉ** ✅
- T-192 — KNOWN_LIMITATIONS purgé + env:restore — **VALIDÉ** ✅
- T-191 — CI reproductible + workflow GHA prêt — **VALIDÉ** ✅

## Prochaine
- **ID** : T-195
- Reste à décision utilisateur : activer le workflow GHA (permission) ;
  arbitrer T-108→T-112 ; polices auto-hébergées si CDN accessible.
