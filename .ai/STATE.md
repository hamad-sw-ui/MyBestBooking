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
- **Dernier commit stable référencé** : `cbb3b2e` (feat(.ai): auto-audit + framework v1.0.1)
- **Version du Framework** : 1.0.2 (AI-DOS Web, hybride — voir `PROCESS_IMPROVEMENTS.md` pour le journal des règles)

## 🛠️ État Technique

- **Dernier `npm run typecheck`** : ❓ non exécuté (pas de `node_modules`
  installés en sandbox)
- **Dernier `npm run build`** : ❓ non exécuté
- **Dernière exécution des tests** : n/a (aucun test défini dans le dépôt)
- **Couverture actuelle** : **0 %** — aucun test automatisé n'existe encore

- **Dette technique majeure** :
  - 🔴 `JWT_SECRET` a un fallback hard-codé (`src/lib/auth.ts:9`)
  - 🔴 `POST /api/seed` accessible publiquement sans auth
  - 🔴 Paiement mocké (`paymentStatus: 'paid'` en dur dans `POST /api/bookings`)
  - 🟠 N+1 sur `GET /api/properties` (rooms par property)
  - 🟠 Pas de `middleware.ts` de protection globale
  - 🟠 Aucune migration Drizzle versionnée
  - 🟡 `<img>` HTML partout au lieu de `next/image`
  - 🟡 `useSearchParams()` sans `<Suspense>` dans `reservation/page.tsx`
  - 🟡 `lucide-react` sur une version majeure suspecte (1.33.0)

## 📋 Progression

- **Dernières tâches terminées** :
  - T-000 v1 — Mise en place initiale framework v1.0.0 (`4ad8884` + `455c121`) — **VALIDÉ**
  - T-000 v1.1 — Auto-audit tour 1 + framework v1.0.1 (`cbb3b2e`) — **VALIDÉ**
  - T-000 v1.2 — Auto-audit tour 2 + framework v1.0.2 (commit de session en cours) — **INSPECTION**, attente validation responsable
- **Tâche en cours** : voir `CURRENT_TASK.md` — **T-001** (JWT_SECRET obligatoire au boot, niveau **C**).
- **Prochaines tâches prévues** :
  - T-002 : protection de `/api/seed` (BUG-002, niveau C)
  - T-003 : middleware.ts de protection (BUG-005, niveau S)
  - Session 4 : traitement des jaunes C-J reportés (voir `PROCESS_IMPROVEMENTS.md`)

## 🐞 Bugs & Défauts

- **Bugs Ouverts** : BUG-001 → BUG-015 (voir `BUGS.md`)
- **Bugs Corrigés (VALIDÉ)** : —
- **Bugs en `CORRIGÉ (INSPECTION)`** : —
- **Tâches VALIDÉ** : T-000 v1, T-000 v1.1
- **Tâches INSPECTION** : T-000 v1.2 (attente validation responsable)

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

## 🕒 Dernière Mise à jour

- **Date** : 2026-08-20 (Session 3 — auto-audit tour 2, framework v1.0.2)
- **Agent** : Arena Agent Mode
- **Prochaine mise à jour attendue** : à chaque fin de session — obligatoire
  §11. La règle de mise à jour est **vérifiée mécaniquement** par
  `npm run ai:check` (voir `scripts/check-ai.mjs`, règles R2 R7 R10 R11 R12 R13).
