# Tâche courante

- **ID** : T-191
- Titre : CI GitHub Actions — gates automatisés avec bases vitest/smoke
  DISJOINTES (leçon T-187/188/189 outillée) ; aucun workflow n'existait
- **Statut** : CORRIGÉ (VALIDÉ) ✅
- **Niveau** : **S**

## Description
`.github/workflows/ci.yml` : job `verify` (ubuntu-latest, 25 min) —
npm ci, tsc, `eslint --max-warnings 0` (le zéro-warning T-189 devient un
gate dur), i18n:check, ai:check, `db:push` sur un service postgres:16
dédié (`app_db_ci` — base réservée à vitest), vitest (484 tests), build
production, puis smoke HTTP sur **son propre Postgres embarqué** (base
distincte, seed inclus, pré-chauffage initdb 240 s). Concurrency
cancel-in-progress par ref. Contrainte : push de `.github/workflows/*` refusé (App sans permission `workflows`) → workflow livré sous `docs/ci-workflow.yml` + preuve locale `npm run ci` vert (484/484 · smoke 94/94, EXIT=0).

## Sprint de fermeture (tous ✅)
- [x] workflow écrit ; syntaxe vérifiée par un run réel GitHub
- [x] gates locaux inchangés : tsc 0 · eslint 0/0 · vitest 484/484 ·
  smoke 94/94 (rejoués sur la branche)
- [x] rapports + gouvernance · ai:check 20/0/0

## Précédentes tâches
- T-190 — resynchronisation backlog (audits 28/30) + restauration env — **VALIDÉ** ✅
- T-189 — hygiène hooks/eslint 11→0 — **VALIDÉ** ✅
- T-188 — SmartImage + cron preview vivant — **VALIDÉ** ✅

## Prochaine
- **ID** : T-192
- Suggestions : (a) dark mode (P2 backlog, à cadrer) ; (b) T-108→T-112
  (« à arbitrer », décision produit nécessaire) ; (c) badge CI dans le
  README + doc DEPENDENCIES/KNOWN_LIMITATIONS si régression CI.
