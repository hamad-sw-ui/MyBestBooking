# 🎯 TÂCHE EN COURS

**ID** : T-167

**Niveau de proportionnalité** : S (additif — dictionnaire + wiring UI, aucun contrat API cassé)

**Titre** : i18n vague 3 — restes FR en dur (auth, compte, messages, chrome) puis dashboard privé (settings, bulk, formulaires).

**Statut** : **EN COURS** — pas CORRIGÉ. 🔨 `npx tsc --noEmit` 0. 🧪 `ui-strings` FR/EN 1087/1087. 🔍 `i18n:check` 55 lignes / 19 fichiers (warn-only). ❓ SSR cookie `en` non rejoué (serveur non lancé).

**Activité** : extraction vers `ui-strings.ts` + `useT` / `makeT(await getServerLocale())` + `UiLocaleProvider`. Interpolation via `.replace("{n}", …)` (ne pas changer `makeT`).

## Périmètre branché cette vague

- Auth, compte, messages, chrome dashboard (déjà HEAD `57a30fd` + working tree)
- `settings-panel`, managers bulk, analytics, billing, bookings `[id]`, properties `new`/`[id]`, `rate-plans-section`, `availability-calendar`

## Restes FR (hors clôture)

Garde-fou encore : `new-room-form`, `booking-row-actions`, `review-moderate-actions`, `property-card-client`, `user-suspend-actions`, `property-submit-button`, `price-alert` UI, etc. Quelques libellés sans accent restent en dur (ex. « Voir la fiche », titres bulk « Chambres »).
