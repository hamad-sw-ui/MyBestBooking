# 🧪 TEST_PLAN — stratégie de tests

État actuel : **couverture 0 %.** Aucun runner de test n'est configuré dans
le dépôt. Ce document décrit la stratégie cible et les jalons pour y arriver.
Il est cité par `CODING_RULES.md` §10 et §13.4.

## 1. Objectifs

- **Non-régression** : chaque bug corrigé donne lieu à un test qui aurait
  échoué avant le fix et qui passe après.
- **Contrat d'API stable** : chaque route publique de `/api/*` a au moins un
  test d'intégration nominal + un test d'erreur (401/400/403 selon).
- **Logique métier vérifiée** : les calculs monétaires (`bookings`,
  commissions, nuits), les générateurs (`generateBookingReference`,
  `generateSlug`), les utilitaires de format sont couverts à 100 % par des
  tests unitaires.
- **Parcours utilisateur critique** : inscription → connexion → recherche →
  réservation → avis a un smoke test E2E.

## 2. Stack cible

| Type | Outil | Cible |
|---|---|---|
| Unitaire (pur TS) | **Vitest** | `src/lib/*.ts`, calculs métier |
| Composant React | **Vitest** + `@testing-library/react` | `src/components/ui/*` |
| Intégration API | **Vitest** + `node-fetch` sur un serveur `next start` de test | `src/app/api/**/route.ts` |
| E2E | **Playwright** | parcours voyageur, parcours hôte |
| DB de test | PostgreSQL en Docker éphémère, seedée avec un sous-ensemble déterministe | commun à intégration + E2E |

## 3. Convention de nommage

- `*.test.ts` à côté du fichier testé (`src/lib/utils.test.ts`).
- `tests/e2e/*.spec.ts` pour Playwright.
- Suites organisées par domaine (`describe("bookings")`, `describe("auth")`).

## 4. Politique de couverture

| Zone | Cible |
|---|---|
| `src/lib/utils.ts` | 100 % branches |
| `src/lib/auth.ts` | 100 % branches (auth = zone critique) |
| `src/app/api/**/route.ts` | 100 % handlers, ≥ 1 test nominal + 1 test d'erreur par handler |
| `src/db/schema.ts` | 0 % (déclaratif — pas de tests) |
| `src/app/**/page.tsx` | Priorité aux pages critiques (auth, réservation) via E2E ; pas d'obligation unitaire |
| `src/components/ui/*` | ≥ 60 % (rendus + interactions clés) |

Une PR qui **fait baisser** la couverture globale doit expliquer pourquoi
dans sa description (§17 rétrospective).

## 5. Doubles validations obligatoires (§13.5)

Pour toute tâche de niveau **C**, le test automatisé doit être écrit :

- soit **avant** l'implémentation (TDD) ;
- soit par une **personne différente** de l'implémenteur ;
- soit à partir d'une **spécification indépendante** (Zod schema, contrat
  d'API documenté, cas de test rédigé dans le rapport de conception).

Objectif : que le test ne se contente pas de reproduire les mêmes
erreurs de raisonnement que l'implémentation.

## 6. Données de test

- **Fixtures déterministes** dans `tests/fixtures/` : un utilisateur
  `admin@test.local`, un `host@test.local`, un `customer@test.local`,
  deux properties, trois rooms, une booking.
- **Réinitialisation** entre les suites d'intégration : `TRUNCATE ...
  RESTART IDENTITY CASCADE` ou base éphémère par run.
- **Interdit** : dépendre de l'internet public (unsplash, google fonts) dans
  un test.

## 7. Jalons de mise en place

- **J1** : ajouter Vitest, configurer `vitest.config.ts`, écrire les
  premiers tests unitaires sur `src/lib/utils.ts` et
  `src/lib/auth.ts` (hash/verify, token round-trip).
- **J2** : test d'intégration `POST /api/auth/register` + `POST /api/auth/login`
  → cookie de session posé.
- **J3** : test d'intégration `POST /api/bookings` avec fixtures, vérifier
  commission et net-to-host.
- **J4** : Playwright — smoke test inscription → recherche → réservation.
- **J5** : GitHub Actions : `lint`, `typecheck`, `test`, `build` sur chaque
  push de `arena/01a01eee-mybestbooking`.

Chaque jalon fait l'objet d'une tâche dédiée dans `BACKLOG.md` et suit la
proportionnalité **S** (analyse d'impact + conception + ADR).

## 8. Ce qu'on refuse

- Un test qui appelle la vraie base de production.
- Un test qui dépend de l'ordre d'exécution des autres.
- Un test qui ignore silencieusement les erreurs (`try {} catch {}`).
- Un `expect(true).toBe(true)` posé pour faire monter la couverture.
- Un test qui **teste le mock** au lieu du code réel.

## 9. Interdiction de progression sans preuve

Un bug corrigé, marqué `CORRIGÉ (VALIDÉ)`, sans test associé référencé dans
`TRACEABILITY.md` est réputé **non valide** (§22). Cette règle entrera en
vigueur dès que **J1** est livré (une fois qu'écrire un test est
techniquement possible).
