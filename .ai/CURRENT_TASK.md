# Tâche courante

- **ID** : T-189
- Titre : Hygiène hooks & directives eslint — 11 warnings → 0 (cause
  racine : `useT()` instable ; micro-bug i18n du filtre chambres corrigé)
- **Statut** : CORRIGÉ (VALIDÉ) ✅
- **Niveau** : **S**

## Description
`eslint src` complet : 11 warnings, 0 erreur. Cause racine : `useT()`
recréait `makeT()` à chaque render → `t` jamais inscriptible en deps des
hooks (5 effects, 1 memo). Correction : `useMemo(makeT, [locale])` — `t`
stable ; 5 effets inscrivent `t` (sûr, re-déclenchés au changement de
langue → messages localisés). `rooms-manager` : `roomTypeLabel` en
`useCallback([t])` (corrige le filtre texte figé sur l'ancienne langue —
micro-bug i18n réel). `promotions-manager` : `now` mémoïsé au montage.
5 directives eslint orphelines retirées. Résultat : **0 erreur,
0 warning** sur tout `src`. Aucun comportement modifié.

## Sprint de fermeture (tous ✅)
- [x] eslint 11 → 0 · tsc 0 · vitest 484/484 ×2 isolés · build 60/60
- [x] pages touchées probées 200 (hôte/admin/customer, EN compris)
- [x] smoke 94/94 · i18n:check 0 · perf inchangée
- [x] rapports (audit, validation) + gouvernance

## Précédente tâche
- **ID** : T-188 — SmartImage + cron preview vivant — **VALIDÉ** ✅

## Prochaine
- **ID** : T-190
- Suggestions : (a) dark mode (P2 backlog, chantier dédié à cadrer) ;
  (b) audit d'exécution des boutons restants « grisés » du footer si le
  scope marketing est décidé ; (c) renforcer la CI : smoke et vitest
  lancés sur bases distinctes (leçon T-187/188/189).
