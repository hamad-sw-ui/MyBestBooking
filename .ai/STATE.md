# 🧠 ÉTAT DU PROJET (STATE)

> Ce document est la **mémoire officielle** du projet MyBestBooking.
> Il est mis à jour à la **fin de chaque cycle de développement**.
> Source de vérité n°1 : en cas de conflit avec un autre document `.ai/`,
> `STATE.md` prime pour l'état, `CODING_RULES.md` prime pour les règles.

## 📌 Identification

- **Projet** : MyBestBooking
- **Dépôt** : `hamad-sw-ui/MyBestBooking`
- **Branche de session** : `arena/01a01eee-mybestbooking`
- **Dernier commit connu** : `4ad8884` (docs(.ai): réécrit le dossier .ai/ …)
- **HEAD attendu** : à confirmer via `git rev-parse HEAD` en début de session
- **Version du Framework** : 1.0.0 (AI-DOS Web, hybride)

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

- **Dernière tâche terminée** : Réécriture complète du dossier `.ai/`
  (framework de gouvernance hybride v1.0.0). Commit `4ad8884` + le commit
  courant qui ajoute la couche gouvernance.
- **Tâche en cours** : voir `CURRENT_TASK.md`.
- **Prochaine tâche prévue** : sécurisation P1 (JWT_SECRET obligatoire au
  boot + protection de `/api/seed`) — voir `BACKLOG.md`.

## 🐞 Bugs & Défauts

- **Bugs Ouverts** : B-001 → B-015 (voir `BUGS.md`)
- **Bugs Corrigés (VALIDÉ)** : —
- **Bugs en `CORRIGÉ (INSPECTION)`** : —

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

- **Date** : 2026-08-20
- **Agent** : Arena Agent Mode (première mise en place du framework)
- **Prochaine mise à jour attendue** : fin de la prochaine session
