# À installer manuellement — GitHub Actions CI

- **Date** : 2026-08-20 (Session 4)
- **Statut** : ⚠️ prêt à copier, **non commité** parce que le token Git
  utilisé par Arena Agent Mode n'a pas la permission `workflows` sur ce
  dépôt GitHub. À ajouter manuellement par le responsable via l'UI
  GitHub ou avec un token disposant du scope `workflow`.

## Fichier à créer : `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, "arena/**"]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Lint • Typecheck • Test • Build • AI-check
    runs-on: ubuntu-latest
    timeout-minutes: 15

    env:
      DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/app_db
      JWT_SECRET: ci-secret-64chars-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      NODE_ENV: test

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: app_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Push schema (Drizzle)
        run: npm run db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/app_db

      - name: AI framework consistency check
        run: npm run ai:check

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

## Comment l'installer

Deux options :

### Option A — via l'UI GitHub
1. Aller sur https://github.com/hamad-sw-ui/MyBestBooking
2. Onglet **Actions** → « New workflow » → « Set up a workflow yourself »
3. Nommer le fichier `ci.yml`, coller le contenu ci-dessus, commit.

### Option B — via git en local avec un token adapté
1. Créer un Personal Access Token avec scope **`workflow`**
   (https://github.com/settings/tokens).
2. `git remote set-url origin https://x-access-token:<TOKEN>@github.com/hamad-sw-ui/MyBestBooking.git`
3. Créer et pousser le fichier `.github/workflows/ci.yml`.

## Ce que la CI garantit une fois en place

- Chaque push et chaque PR déclenche `lint + typecheck + test + build + ai:check`
  sur Ubuntu Node 22 avec Postgres 16.
- La règle `unchecked_pre_commit_checklist` du framework devient
  partiellement mécanisable (blocage au niveau PR).
- Un ticker vert sur chaque commit sert de preuve reproductible pour
  §22 (audit).

## Suite

Une fois ajouté par le responsable, retirer ce rapport et cocher
« CI ajoutée » dans PROCESS_IMPROVEMENTS.md Session 5.
