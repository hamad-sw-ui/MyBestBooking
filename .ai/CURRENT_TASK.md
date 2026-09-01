# 🎯 TÂCHE EN COURS

**ID** : T-170

**Niveau de proportionnalité** : S (additif — JSON `message` + bulk skipped/failed via `apiError` ; défaut **fr**)

**Titre** : i18n — succès API, motifs bulk, transitions réservation.

**Statut** : **CORRIGÉ** (2026-09-01)

**Activité** : wrap HTTP `message` (login, register, forgot/reset/change-password, resend-verif, rooms, properties, seed, provider test) ; `localizeBulkResult` ; dict + regex (transitions, Connexion X validée, skip bulk). `frenchZodMessage` sur login/register/forgot. Lib FR inchangée. Stripe signature non wrappée. `makeT` inchangé.

## Preuves de clôture

- 🔨 `npx tsc --noEmit` 0
- 🔍 `i18n:check` **0 candidat**
- 🧪 `src/lib` vitest **324 passed** / 12 skipped
- ❓ smoke HTTP non rejoué — défaut locale **fr**

Rapport : `REPORTS/validation_T-170_2026-09-01.md`.
