# Projet MyBestBooking

## Identite
MyBestBooking est une plateforme web de reservation d'hebergements. Le depot applicatif est le dossier `MyBestBooking/`.

## Stack reelle
- Next.js 16 avec App Router et React 19
- TypeScript 5.9
- PostgreSQL 17
- Drizzle ORM et Drizzle Kit
- ESLint 9 et Tailwind CSS 4

## Commandes
Depuis `MyBestBooking/` :

```powershell
npm run typecheck
npm run lint
npm run build
npm run dev -- --port 3000
npm run start -- --port 3002
npx drizzle-kit push
```

## Environnement
`DATABASE_URL` est obligatoire pour les routes et le build. La configuration locale attendue est dans `.env.local` et ne doit pas etre commitee.

## Etat verifie le 2026-08-20
- PostgreSQL 17 actif et base `app_db` creee.
- Schema Drizzle synchronise.
- Build production reussi.
- `/api/health` retourne HTTP 200 avec `ok: true`.
- Donnees de demonstration chargees via `/api/seed`.

Les documents Android/MobileCaisse presents dans `.ai/` sont des archives historiques d'un autre projet et ne decrivent pas ce code.
