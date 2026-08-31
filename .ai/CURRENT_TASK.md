# 🎯 TÂCHE EN COURS

**ID** : T-167

**Niveau de proportionnalité** : S (additif — dictionnaire + wiring UI, aucun contrat API cassé)

**Titre** : i18n vague 3 — restes FR en dur (auth → dashboard → widgets).

**Statut** : **EN COURS** (inspection). 🔨 `npx tsc --noEmit` 0. 🧪 ui-strings 4/4 (1213 FR=EN). 🔍 `i18n:check` **0 candidat**. ❓ SSR cookie `en` non rejoué.

**Activité** : extraction vers `ui-strings.ts` + `useT` / `makeT`. Interpolation `.replace` / `.replaceAll` (ne pas changer `makeT`).

## Branché

- Auth, compte, messages, chrome dashboard
- settings-panel, bulk, analytics/billing, bookings `[id]`, properties new/`[id]`, rate-plans, calendrier
- Widgets restants du garde-fou : new-room, room-edit, promo-form, booking-row-actions, review-moderate, user-suspend, stripe-payment, host-reply, wishlists, price-alert, property-card, submit-button, bestrewards-status, attachments, descriptions

## Restes possibles

Libellés **sans accent** encore en dur (non vus par le garde-fou) : ex. « Voir la fiche », « Chambres », « No-show ». Pas de preuve runtime EN sur cookie.
