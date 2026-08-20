# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-011
- **Titre** : Framework v1.1.0 — élargissement à la complétude produit
- **Niveau** : **C** (§15.0-bis — modifie les règles opposables §1-§22 :
  ajoute R14-R17, tag 🎯 PROMISED, 2 documents obligatoires)
- **Ouverte le** : 2026-08-20 (Session 5)
- **Prédécesseur** : Session 4 clôturée (T-000 v1.3, 14 bugs corrigés)

## Contexte

À la question du responsable « pourquoi le framework n'a pas trouvé les
manques ? » (Session 5, tour 2 d'introspection), la réponse a mis en
évidence un défaut structurel : le framework surveillait la **discipline
de processus** mais pas la **complétude produit**.

## Décision — ADR-006

Le framework passe de « surveillant de processus » à « surveillant
de processus **ET** de complétude produit ». Voir
`ADR/ADR-006_Portee_Framework_Completude_Produit.md`.

## Livrables

### Vague 1 — Framework v1.1.0 (ce commit)

- [x] 🔍 ADR-006 acté (contexte + décision + 4 alternatives évaluées + conséquences)
- [x] 🔍 Analyse d'impact §14 (9 questions)
- [x] 🔍 Analyse de conception §15.1 (4 options A/B/C/D)
- [x] 🔍 Débat multi-rôles §15.2 (11 rôles, 4 objections résolues)
- [x] 🔍 `framework.manifest.json` v1.0.3 → v1.1.0 avec :
  - 2 nouveaux documents obligatoires (`FEATURES.md`, `PRODUCT_ACCEPTANCE.md`)
  - nouveau tag §16 `🎯 PROMISED`
  - section `product_coverage` (tables, labels UI, seuils)
  - 4 nouvelles blocking_rules (dont 3 warnings, 1 aspirationnelle)
- [x] 🔍 `.ai/FEATURES.md` peuplé exhaustivement (~122 features tracées :
  ✅ ~34, 🚧 ~18, 🎯 ~45, ❌ ~25 → couverture 28 %)
- [x] 🔍 `.ai/PRODUCT_ACCEPTANCE.md` avec 20 parcours PAR-xxx (P1/P2/P3)
- [x] 🔍 `scripts/check-ai.mjs` étendu de 13 à 17 règles :
  - R14 db_api_coverage
  - R15 ui_api_coverage
  - R16 backlog_hygiene (raffiné : matching par BUG-xxx explicite)
  - R17 freshness (compteur audit produit + FEATURES + PROGRESS)
- [x] 🔍 `.ai/CODING_RULES.md §16` ajoute le tag 🎯 PROMISED
- [x] 🔍 `.ai/INDEX.md` : `FEATURES` et `PRODUCT_ACCEPTANCE` insérés dans
  l'ordre de lecture prescrit
- [x] 🔍 `.ai/STATE.md` : compteur `sessions_since_last_product_audit: 0`
- [x] 🔍 `.ai/BACKLOG.md` **complètement réécrit** (nettoyage des items
  déjà corrigés Sessions 3-4, planification T-012 → T-020 selon FEATURES)
- [x] 🔍 Playwright installé (`@playwright/test`), `playwright.config.ts`,
  6 smoke tests dans `tests/e2e/smoke.spec.ts`, scripts `e2e` + `e2e:ui`
- [x] 🔨 `npm run typecheck` → 0 erreur
- [x] 🧪 `npm test` → **43/43 passent** (aucune régression Vitest)
- [x] ▶️ `npm run ai:check` → **13 OK · 4 warn · 0 fail** (les warns
  R14/R15 révèlent la nouvelle roadmap : 5 tables sans endpoint,
  2 boutons UI orphelins)

## Statut

**CORRIGÉ (INSPECTION)** — la Vague 1 est livrée. Les Vagues 2 et 3
(T-012 à T-020) s'appuient sur ce framework élargi pour combler les
manques produit détectés.

Passage à **VALIDÉ** après :
- Validation responsable
- Fin de Vague 3 (T-020 Stripe test-mode livré) → dernière tâche de la
  campagne de complétude

## Vagues suivantes (à venir dans cette session)

### Vague 2 — API mutations manquantes (T-012 à T-015)
- T-012 disponibilité + chevauchement bookings (S)
- T-013 emails transactionnels (S)
- T-014 uploads d'images (S)
- T-015 endpoints manquants (messages, reply, promo, wishlist share, admin)

### Vague 3 — Paiement & tests (T-019, T-020)
- T-019 tests d'intégration API + Playwright E2E (S)
- T-020 Stripe test-mode + webhook (C)

## Prochaine tâche

Après commit Vague 1 : basculer sur **T-012** (disponibilité bookings).
