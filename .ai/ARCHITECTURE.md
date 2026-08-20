# 🏗️ Architecture

Ce document décrit **ce qui existe réellement dans le code** au moment de sa
dernière mise à jour. Si vous constatez un écart, ajustez-le : ce fichier n'a
pas vocation à représenter une architecture cible idéale.

## 1. Vue d'ensemble

Application **Next.js App Router** monolithique, hébergée sur Node.js, adossée
à une base **PostgreSQL** unique. Aucun microservice, aucun worker externe.

```
Navigateur ──HTTP──▶ Next.js (Node)
                       │
                       ├── React Server Components (pages/layouts)
                       ├── Route handlers /api/* (REST)
                       └── Drizzle ORM ──▶ Pool pg ──▶ PostgreSQL
```

L'auth est gérée **côté serveur** dans les RSC via `getCurrentUser()` qui lit
le cookie `session`, vérifie le JWT et charge l'utilisateur en base. Le cookie
est `HttpOnly` + `SameSite=Lax` (+ `Secure` en production).

## 2. Arborescence du code

```
MyBestBooking/
├── package.json           # scripts dev/build/start/lint/typecheck
├── next.config.ts         # actuellement vide
├── tsconfig.json          # strict, alias "@/*" → ./src/*
├── eslint.config.mjs      # flat config next/core-web-vitals
├── postcss.config.mjs     # tailwindcss v4
├── drizzle.config.json    # dialect postgresql, schema=./src/db/schema.ts
└── src/
    ├── app/               # Next.js App Router
    │   ├── layout.tsx     # <html lang="fr">, fonts, ToastProvider
    │   ├── globals.css    # Tailwind + tokens couleur + scrollbar
    │   ├── page.tsx       # accueil (RSC)
    │   ├── (auth)/        # route group — public
    │   │   ├── layout.tsx
    │   │   ├── connexion/page.tsx
    │   │   └── inscription/page.tsx
    │   ├── (main)/        # route group — voyageur connecté ou non
    │   │   ├── layout.tsx           # Header + Footer, auth optionnelle
    │   │   ├── recherche/page.tsx
    │   │   ├── hebergement/[slug]/page.tsx
    │   │   ├── reservation/page.tsx  # tunnel de réservation (577 l.)
    │   │   ├── mes-reservations/page.tsx
    │   │   ├── mes-favoris/page.tsx
    │   │   ├── messages/page.tsx
    │   │   ├── mon-compte/page.tsx   # 421 l.
    │   │   ├── bestrewards/page.tsx
    │   │   └── aide/page.tsx
    │   ├── dashboard/     # protégé : rôle host ou admin
    │   │   ├── layout.tsx           # redirect si non autorisé
    │   │   ├── page.tsx             # vue d'ensemble
    │   │   ├── properties/          # + [id]/ + new/
    │   │   ├── rooms/
    │   │   ├── bookings/            # + [id]/
    │   │   ├── reviews/
    │   │   ├── messages/
    │   │   ├── promotions/
    │   │   ├── analytics/
    │   │   ├── billing/
    │   │   ├── users/
    │   │   └── settings/
    │   └── api/           # route handlers REST
    │       ├── health/route.ts
    │       ├── seed/route.ts         # ⚠️ voir SECURITY.md
    │       ├── auth/{register,login,logout,me}/route.ts
    │       ├── properties/route.ts + [id]/route.ts
    │       ├── rooms/route.ts + [id]/route.ts
    │       ├── bookings/route.ts + [id]/route.ts
    │       ├── reviews/route.ts
    │       └── wishlists/route.ts
    ├── components/
    │   ├── layout/
    │   │   ├── header.tsx
    │   │   ├── footer.tsx
    │   │   ├── dashboard-sidebar.tsx
    │   │   └── dashboard-mobile-header.tsx
    │   ├── property-card.tsx
    │   └── ui/                       # design system interne
    │       ├── button.tsx
    │       ├── card.tsx
    │       ├── input.tsx             # Input, Textarea, Select
    │       ├── badge.tsx
    │       ├── modal.tsx
    │       ├── skeleton.tsx
    │       ├── empty-state.tsx
    │       └── toast.tsx             # ToastProvider + useToast
    ├── db/
    │   ├── index.ts       # Pool pg (singleton via globalThis en dev)
    │   └── schema.ts      # 14 tables Drizzle + types exportés
    └── lib/
        ├── auth.ts        # hashPassword, verifyPassword, createSession,
        │                  # getSession, getCurrentUser, logout, requireAuth
        └── utils.ts       # cn, formatPrice/Date, generateSlug,
                           # generateBookingReference, calculateNights…
```

## 3. Couches et flux

### 3.1 Rendu

- **Layouts** et pages sont des **RSC** par défaut. On récupère l'utilisateur
  courant directement dans le layout via `await getCurrentUser()`.
- Les pages fortement interactives (`connexion`, `inscription`, `reservation`,
  `header`, `toast`, dashboard) sont marquées `"use client"` en tête de fichier.
- Le `Header` reçoit `user` en prop depuis le layout pour éviter un appel côté
  client.

### 3.2 Accès aux données

- **Un seul pool `pg`** exporté par `src/db/index.ts`, mémorisé sur `globalThis`
  en dev pour survivre au HMR.
- `db = drizzle(pool, { schema })` : les requêtes sont typées.
- Les RSC lisent directement `db` (accueil, layouts, pages dashboard).
- Les mutations passent presque toujours par une route `/api/*` appelée en
  `fetch` depuis un composant client.

### 3.3 Authentification

Flux détaillé dans `SECURITY.md`. En résumé :

1. `POST /api/auth/register` ou `/login` → `bcrypt.compare` → `createSession()`
2. `createSession()` : signe un JWT (`jose`, HS256, exp 30j), insère une ligne
   dans `sessions`, dépose le cookie `session`.
3. `getCurrentUser()` : lit le cookie, vérifie le JWT, vérifie la session en
   base, retourne le `User` ou `null`.
4. `POST /api/auth/logout` : supprime la ligne `sessions`, supprime le cookie,
   redirige vers `/`.

Le **layout `dashboard/`** applique lui-même la garde (`redirect('/connexion')`
si non connecté, `redirect('/')` si rôle non autorisé). Il **n'y a pas de
`middleware.ts`** aujourd'hui.

### 3.4 Autorisation par rôle

Trois rôles dans `users.role` : `customer` (défaut), `host`, `admin`.

- `/dashboard/*` : layout autorise `host` et `admin`.
- `POST /api/properties` : seuls `host` et `admin` peuvent créer une property
  (les admins la mettent directement en `active`, les hosts en `pending`).
- `GET /api/bookings` filtre selon le rôle :
  - `customer` → ses propres bookings ;
  - `host` → bookings sur ses properties ;
  - `admin` → tout.

## 4. Conventions Next.js utilisées

- **Alias TypeScript** : `@/…` → `src/…`.
- **Route groups** `(auth)` et `(main)` pour partager un layout sans polluer
  l'URL.
- **Segments dynamiques** : `[slug]`, `[id]`.
- **`cookies()`** (`next/headers`) est appelé avec `await` (Next 15+/16 : API
  asynchrone).
- **`useSearchParams()`** est utilisé dans `reservation/page.tsx` ; à
  wrapper dans un `<Suspense>` si Next 16 le réclame au build.

## 5. Écarts et zones grises connus

- **Pas de `middleware.ts`** : la protection repose entièrement sur les layouts
  et les handlers.
- **`next.config.ts` vide** : pas de headers de sécurité, pas de config
  `images.remotePatterns` (or on charge des images `unsplash.com` en `<img>`).
- **Boucle N+1** dans `GET /api/properties` (une requête `rooms` par property
  après la liste).
- **`<img>` HTML** partout au lieu de `next/image`.
- **Le paiement n'est pas branché** : `paymentStatus = 'paid'` en dur à la
  création du booking.
- **Aucune migration Drizzle commitée** (`drizzle-kit push` en local seulement).
