# 🎯 TÂCHE EN COURS

**ID** : T-167

**Niveau de proportionnalité** : S (additif — dictionnaire + wiring UI, aucun contrat API cassé)

**Titre** : i18n vague 3 — restes FR en dur (auth → dashboard → widgets).

**Statut** : **CORRIGÉ (VALIDÉ)** (2026-09-01)

**Activité** : extraction vers `ui-strings.ts` + `useT` / `makeT`. Interpolation `.replace` / `.replaceAll` (ne pas changer `makeT`). SSR cookie `en` via `getServerLocale` + proxy.

## Preuves de clôture

- 🔨 `npx tsc --noEmit` 0
- 🔍 `i18n:check` **0 candidat**
- 🧪 catalogue **1354** FR=EN · proxy cookie RFC + historique
- ▶️ curl cookie `mybb-ui-language=en` : `html lang=en`, « Book better. », Login, Display currency ; défaut FR intact

Rapport : `REPORTS/validation_T-167_2026-09-01.md`.
