# 💻 Environnement de développement

## Prérequis

- **Node.js** ≥ 20 (Next 16 exige Node 20+).
- **PostgreSQL** 14+ accessible localement, ou une instance distante (Neon,
  Supabase, Railway, RDS…).
- **npm** (le dépôt n'utilise pas pnpm/yarn — pas de lockfile alternatif).

## Variables d'environnement

Créer un fichier `.env.local` à la racine (jamais commité) :

```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/app_db"
JWT_SECRET="<chaîne aléatoire ≥ 32 caractères, générée avec openssl rand -hex 32>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

- `DATABASE_URL` est **obligatoire** : `src/db/index.ts` throw au démarrage
  s'il est absent.
- `JWT_SECRET` est **obligatoire depuis 2026-08-20** (T-001, ADR-003) :
  `src/lib/auth.ts` throw au chargement si absent, warn si < 32 caractères.
  Générer avec `openssl rand -hex 32`.
- `NEXT_PUBLIC_APP_URL` : utilisé par la redirection `logout`. Défaut
  `http://localhost:3000` si absent.

Voir aussi le fichier `.env.example` à la racine, qui documente le format
et les valeurs par défaut.

## Installation

```bash
npm install
```

## Base de données

### Option A — Docker rapide

```bash
docker run --name mbb-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=app_db -p 5432:5432 -d postgres:16
```

### Créer / synchroniser le schéma

Aucun script npm n'est encore défini pour Drizzle. En attendant :

```bash
# Pousse le schéma actuel vers la DB (dev only, pas de versionning)
npx drizzle-kit push --config=drizzle.config.json

# Ouvre Drizzle Studio pour explorer la DB
npx drizzle-kit studio --config=drizzle.config.json
```

### Peupler avec des données de démo

```bash
curl -X POST http://localhost:3000/api/seed
```

Insère 8 propriétés, un compte admin `admin@mybestbooking.com`, quelques rooms
et un jeu d'avis. ⚠️ Cette route est publique aujourd'hui — voir `SECURITY.md`.

## Scripts npm existants

| Script | Ce qu'il fait |
|---|---|
| `npm run dev` | Serveur Next.js en mode dev (port 3000, HMR) |
| `npm run build` | Build de production |
| `npm run start` | Lance le build de production |
| `npm run lint` | ESLint sur tout le projet |
| `npm run typecheck` | `tsc --noEmit`, ne génère rien |

**Scripts qui manquent** (à ajouter au besoin) :

```json
{
  "db:push":     "drizzle-kit push     --config=drizzle.config.json",
  "db:generate": "drizzle-kit generate --config=drizzle.config.json",
  "db:studio":   "drizzle-kit studio   --config=drizzle.config.json"
}
```

## Lancement

```bash
npm run dev
# ➜ http://localhost:3000
```

Sanity checks :

- `GET http://localhost:3000/api/health` → `{"ok":true}`
- Page d'accueil accessible sans compte
- `/inscription` fonctionne, `/dashboard` redirige vers `/connexion` tant qu'on
  n'a pas un rôle `host` ou `admin`.

## Preview dans un sandbox (Arena)

Si le serveur tourne dans un sandbox Arena, il est déjà exposé via
`https://{port}-{sandboxId}.e2b.app`. Bien binder sur `0.0.0.0` — `next dev`
le fait par défaut.

## Points connus

- **`npm run ai:check` est portable pour les parcours de fichiers.** Les
  contrôles utilisent désormais Node.js au lieu de `find`/`ls`, et le contrôle
  de permission Unix est ignoré sous Windows. Quelques alertes restent
  possibles dans les archives historiques et les heuristiques UI.

- **Le dossier `drizzle/`** contient les migrations versionnées.
- **`.env.example`** est présent ; `.env.local` reste ignoré et local.
- **`README.md`** est présent à la racine du projet.
- **`node_modules`** est absent du dépôt (normal), à réinstaller à chaque clone.
