# 🧠 ÉTAT DU PROJET (STATE)

> Ce document est la **mémoire officielle** du projet MyBestBooking.
> Il est mis à jour à la **fin de chaque cycle de développement**.
> Source de vérité n°1 : en cas de conflit avec un autre document `.ai/`,
> `STATE.md` prime pour l'état, `CODING_RULES.md` prime pour les règles.

## 📌 Identification

- **Projet** : MyBestBooking
- **Dépôt** : `hamad-sw-ui/MyBestBooking`
- **Branche de session** : `arena/01a01eee-mybestbooking`
- **Dernier commit connu** : à mettre à jour en fin de session en cours (voir `git rev-parse --short HEAD` avant clôture)
- **Dernier commit stable référencé** : `541658c` (feat(sec,perf): T-008+T-009+T-010)
- **Version du Framework** : 1.0.3 (AI-DOS Web, hybride — voir `PROCESS_IMPROVEMENTS.md` pour le journal des règles)

## 🛠️ État Technique

- **Dernier `npm run typecheck`** : ✅ 0 erreur (2026-08-20 fin Session 4)
- **Dernier `npm run build`** : ✅ succès
- **Dernier `npm run lint`** : ⚠️ 0 error, 12 warnings (custom fonts,
  non-bloquants, tracés Session 5)
- **Dernier `npm test`** : ✅ **43 passed / 43** (17 utils + 9 auth + 7 seed
  + 5 proxy + 5 rate-limit)
- **Dernier `npm run ai:check`** : ✅ 11 OK · 2 warn · 0 fail
- **Couverture actuelle** : partielle — `src/lib/utils.ts` (100 %),
  `src/lib/auth.ts` (branches critiques), `src/lib/rate-limit.ts` (100 %),
  handlers `/api/seed` et `/api/auth/*` couverts.

- **Dette technique majeure** :
  - ✅ ~~JWT_SECRET fallback~~ (T-001, VALIDÉ)
  - ✅ ~~seed public~~ (T-002, VALIDÉ)
  - ✅ ~~pas de middleware~~ (T-003, VALIDÉ)
  - ✅ ~~N+1 properties~~ (T-004, VALIDÉ)
  - ✅ ~~useSearchParams sans Suspense~~ (T-005, VALIDÉ)
  - ✅ ~~contraintes DB manquantes~~ (T-006, VALIDÉ)
  - ✅ ~~race averageRating~~ (T-007, VALIDÉ)
  - ✅ ~~img HTML natif~~ (T-008, VALIDÉ)
  - ✅ ~~emailVerified d'office~~ (T-008, VALIDÉ)
  - ✅ ~~pas de rate-limit~~ (T-009, VALIDÉ)
  - ✅ ~~lucide-react suspect~~ (T-010, VALIDÉ, faux positif)
  - ✅ ~~pas de migrations~~ (BUG-015 setup + T-006, VALIDÉ)
  - 🟡 **Paiement mocké** : déplacé dans `KNOWN_LIMITATIONS.md`,
    en attente de credentials Stripe test.
  - 🟡 12 warnings ESLint (custom fonts via `<link>` au lieu de `next/font`)

## 📋 Progression

- **Sessions 4-5 (résumé)** :
  - Session 4 : T-000 v1/v1.1/v1.2/v1.3 (framework v1.0.0→v1.0.3) +
    T-001 à T-010 (14 bugs corrigés). VALIDÉ.
  - Session 5 (courante) :
    - T-011 (framework v1.1.0 — élargissement complétude produit) VALIDÉ
    - T-012 (disponibilité + chevauchement bookings) VALIDÉ
    - T-013 (emails transactionnels : verify + reset + booking) VALIDÉ
    - T-014 (uploads d'images Local+S3) VALIDÉ
    - T-015 (6 endpoints mutations : conversations, messages,
      reviews/reply, properties/validate, wishlists/shared, promotions
      CRUD) VALIDÉ
- **Tâche en cours** : clôture Session 5 (voir CURRENT_TASK.md).
- **Prochaines tâches prévues (Session 6+)** :
  - T-016 : UI branchement des endpoints T-015 (compte, réponse avis,
    validation admin, application promo, envoi message)
  - T-017 : SEO + a11y + `next/font` + `error.tsx` + `not-found.tsx`
  - T-018 : éditeur calendrier hôte (rate_plans + room_availability)
  - T-019 : suite de tests d'intégration API + Playwright E2E des PAR
  - T-020 : intégration paiement Stripe test-mode (C) — attente credentials

## 🐞 Bugs & Défauts

- **Bugs Ouverts** : 0 (BUG-003 déplacé dans `KNOWN_LIMITATIONS.md`)
- **Bugs Corrigés (VALIDÉ)** : BUG-001, BUG-002, BUG-004, BUG-005,
  BUG-006, BUG-007, BUG-008, BUG-009, BUG-010, BUG-011, BUG-012, BUG-013,
  BUG-014, BUG-015 → **14 bugs**
- **Bugs en `CORRIGÉ (INSPECTION)`** : —
- **Tâches VALIDÉ** : T-000 v1, v1.1, v1.2, T-001 à T-010 → **13 tâches**
- **Tâches INSPECTION** : T-000 v1.3 (framework v1.0.3, ce commit)

## 🏛️ Décisions & Risques

- **Décisions d'architecture actées** :
  - Stack : Next.js 16 App Router + PostgreSQL + Drizzle + Zod + `jose` +
    `bcryptjs`.
  - Auth : JWT `HttpOnly` + session en base (révocation possible).
  - Rôles : `customer` / `host` / `admin`, appliqués côté layout et handler.
  - Rendu : RSC par défaut, `"use client"` uniquement quand nécessaire.
  - Framework de gouvernance : **AI-DOS Web 1.0.0**, hybride, proportionnalité
    T/L/S/C, checklists bloquantes.

- **Risques connus** :
  - Aucune couverture de tests → refactor risqué.
  - Aucune CI configurée → pas de garde-fou automatique.
  - Paiement mocké → toute réservation est actuellement gratuite.
  - Fallback JWT_SECRET → forge de session admin possible en cas d'oubli
    d'env var en prod.

## 📈 Compteurs framework (§17, ADR-006)

- **sessions_since_last_product_audit** : `0`
  (dernier audit produit : Session 5 — a produit `FEATURES.md`,
  `PRODUCT_ACCEPTANCE.md`, déclenché T-011 à T-015 qui ont fait
  passer la couverture ✅ de 28 % à ~48 %)

## 🕒 Dernière Mise à jour

- **Date** : 2026-08-20 (Session 5 — framework v1.1.0, complétude produit)
- **Agent** : Arena Agent Mode
- **Prochaine mise à jour attendue** : à chaque fin de session — obligatoire
  §11. La règle de mise à jour est **vérifiée mécaniquement** par
  `npm run ai:check` (règles R2, R7, R10, R11, R12, R13, R14, R15, R16, R17).
