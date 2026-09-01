# 🎯 TÂCHE EN COURS

**ID** : T-168

**Niveau de proportionnalité** : S (additif — dictionnaire + wrapping `apiError`, aucun contrat smoke cassé : défaut **fr**)

**Titre** : i18n 100 % produit FR/EN — facture HTML, placeholders réglages, erreurs API.

**Statut** : **CORRIGÉ (VALIDÉ)** (2026-09-01)

**Activité** : clés `inv.*` / `settings.ph*` ; `renderInvoiceHtml(locale)` + `makeT` ; `apiError()` mappe FR→EN selon `getServerLocale` (défaut fr). `makeT` inchangé (`.replace` seulement).

## Preuves de clôture

- 🔨 `npx tsc --noEmit` 0
- 🔍 `i18n:check` **0 candidat**
- 🧪 `src/lib` vitest **323 passed** · catalogue **1394** FR=EN · invoice FR/EN · `localizeApiMessage` défaut FR
- ❓ smoke HTTP non rejoué ici (pas de serveur dur) — défaut locale **fr** inchangé (`frenchZodMessage` + `apiError` sans cookie)

Rapport : `REPORTS/validation_T-168_2026-09-01.md`.
