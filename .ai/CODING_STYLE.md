# ✍️ Conventions de code

Ce document décrit les choix constatés dans le dépôt. Ce sont des repères, pas
des règles rigides — s'il faut s'en écarter pour de bonnes raisons, écartez-vous.

## TypeScript

- **`strict: true`** dans `tsconfig.json`. Ne pas ajouter de `any` sans
  commentaire justifiant.
- **Alias** `@/…` = `src/…`. Toujours l'utiliser, jamais de `../../..`.
- Cible ES2017, `moduleResolution: bundler`, `jsx: react-jsx`.
- `npm run typecheck` = `tsc --noEmit` — pratique avant un commit un peu large.

## Next.js (App Router)

- **RSC par défaut**. Ajouter `"use client"` **uniquement** quand on a besoin
  de hooks, d'événements ou d'état.
- **Layouts asynchrones** autorisés (`export default async function Layout(...)`).
- **`cookies()`** et **`headers()`** sont asynchrones : `const c = await cookies()`.
- **Routes dynamiques** : `params` est asynchrone dans Next 15+/16
  (`{ params: Promise<{ id: string }> }`), penser à `await`.
- **`useSearchParams`** doit être dans un composant enveloppé de `<Suspense>`
  quand la page est statique.

## React

- Fichiers `.tsx`, composants en **PascalCase**.
- Un composant par fichier pour les pages, plusieurs autorisés pour les
  petits blocs internes d'une même vue.
- Props typées avec `interface` local à côté du composant.

## Handlers d'API

Structure recommandée :

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ /* … */ });

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();          // si nécessaire
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const data = schema.parse(await request.json());

    // … logique métier + accès DB

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("…", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
```

Autres règles observées :
- **Messages d'erreur en français**, orientés utilisateur.
- **Toujours logger** l'erreur serveur avec `console.error("<contexte>", error)`
  pour pouvoir la retrouver dans les logs de plateforme.
- Ne **jamais** renvoyer `passwordHash` ni les tokens de session au client.

## Drizzle

- **Un seul export `db`** depuis `@/db`. Ne pas créer d'autres `Pool`.
- **Requêtes typées** via `db.select().from(...)`, éviter `db.execute(sql\`\`)`
  sauf besoin explicite (le seul cas actuel : `/api/health`).
- Utiliser `and(...)`, `or(...)`, `eq`, `ilike`, `desc` importés depuis
  `drizzle-orm`.
- Pour les mises à jour, penser à `updatedAt: new Date()`.

## Zod

- Un schéma **par handler** (au plus haut du fichier).
- Messages d'erreur **en français** dans les schémas (`z.string().min(8, "Le mot de passe…")`).
- Utiliser `.optional()` et `.default(...)` plutôt que de gérer `undefined` à
  la main.

## Tailwind

- Tailwind v4 : imports via `@import "tailwindcss";` + tokens `@theme` dans
  `globals.css`. Pas de fichier `tailwind.config.ts`.
- Éviter la classe arbitraire quand un token existe déjà.
- Regrouper les classes par thème visuel (layout → couleurs → typo → états)
  pour la lisibilité.
- `cn(...)` de `@/lib/utils` pour les classes conditionnelles.

## Nommage

- Composants React : **PascalCase** (`PropertyCard`, `DashboardSidebar`).
- Hooks : **camelCase** commençant par `use…`.
- Fichiers : **kebab-case** (`property-card.tsx`, `dashboard-sidebar.tsx`).
- Routes API : nom au pluriel (`properties`, `bookings`, `reviews`,
  `wishlists`).
- Variables SQL/Drizzle : `camelCase` côté TS, `snake_case` en DB (Drizzle
  fait la conversion via le 1er argument de `varchar()`).

## Erreurs et logs

- **Pas de `catch (e) { /* silence */ }`**. Au minimum `console.error(…, e)`
  ou renvoyer une erreur explicite.
- Éviter les messages d'erreur qui fuient des détails internes au client
  (nom de table, contrainte SQL) — préférer un message neutre + log serveur.

## Ce qu'on évite

- Les `useEffect` qui refetchent en boucle sans dépendances propres.
- Les composants client qui font du fetch au montage alors qu'un RSC ferait
  l'affaire.
- La duplication des types du schéma : réutiliser `User`, `Property`,
  `Booking`, `Review` exportés depuis `@/db/schema`.
- L'appel à `fetch("/api/…")` depuis un RSC : passer directement par `db`.
