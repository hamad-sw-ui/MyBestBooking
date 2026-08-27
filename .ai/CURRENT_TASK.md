# 🎯 TÂCHE EN COURS

**Tâche :** Réalignement du framework `.ai/` (AI-DOS) + clôture T-112.
**ID** : T-113 (framework, niveau S) — inclut la clôture de T-112.
**Niveau** : **S** — garde-fous de gouvernance, preuves, aucune fonctionnalité
métier nouvelle.
**Statut** : **CORRIGÉ (VALIDÉ)**

## Périmètre

- Corriger les règles R10–R15 de `scripts/check-ai.mjs` (branche codée en
  dur, R14 vacante, faux positifs R15, bruit R11, R12 non ciblée).
- Piloter le framework par `.ai/framework.manifest.json` v3.0.1
  (`git.branch_patterns`, `product_coverage`, documents ADR-006).
- Ajouter la CI GitHub Actions (ADR-002).
- Réaligner les documents (INDEX, README, STATE).
- Fournir la preuve manquante de T-112 : test d'intégration
  `src/app/api/conversations/route.test.ts` (idempotence + concurrence).

## Sortie

- 🔨 typecheck 0 erreur · lint 0 erreur · build 57/57.
- 🧪 `npm test` **216/216** (3 nouveaux tests T-112).
- ▶️ `npm run smoke` **91/91** · `npm run ai:check` **20/20**.

Voir `REPORTS/validation_T-112_2026-08-27.md` et la session du
`PROGRESS.md` (2026-08-27).

> Prochaine tâche à cadrer par le responsable : la suite du backlog T-110
> (multi-devises, quote checkout UI, BestRewards/referral, dates bornées,
> E2E Playwright) — voir `BACKLOG.md`.
