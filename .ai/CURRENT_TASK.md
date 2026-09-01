# 🎯 TÂCHE EN COURS

**ID** : T-169

**Niveau de proportionnalité** : S (additif — `localizeApiMessage` préfixes/regex + wrapping `apiError` restant ; défaut **fr**)

**Titre** : i18n — erreurs API interpolées + pays facture + 503 maintenance.

**Statut** : **CORRIGÉ** (2026-09-01)

**Activité** : `localizeApiMessage` exact + préfixes `Code promo : `/`Wallet : ` + motifs (capacité, min-stay, MIME, stock, champ, test, bulk) ; wrap HTTP restant ; facture `countryLabel` ; `maintenanceResponse` async `apiError`. Lib FR inchangée (`booking-rules` / `promotions` / `wallet-currency`). `makeT` inchangé. Stripe `"Invalid signature"` non wrappé.

## Preuves de clôture

- 🔨 `npx tsc --noEmit` 0
- 🔍 `i18n:check` **0 candidat**
- 🧪 `src/lib` vitest **324 passed** / 12 skipped · catalogue **1394** · invoice Maroc/Morocco · préfixes `localizeApiMessage`
- ❓ smoke HTTP non rejoué — défaut locale **fr**

Rapport : `REPORTS/validation_T-169_2026-09-01.md`.
