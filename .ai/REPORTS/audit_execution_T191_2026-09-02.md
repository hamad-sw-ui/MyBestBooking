# Audit d'exécution — T-191 (CI GitHub Actions)

- **Date** : 2026-09-02
- **Constat d'entrée** : aucun `.github/workflows/*` — les gates (tsc,
  eslint, vitest, build, smoke, i18n, ai:check) n'étaient joués qu'à la
  main. Leçon documentée T-187/188/189 : vitest et smoke SE PARASITENT
  quand ils partagent la même base (2 échecs transitoires reproductibles).

## Choix d'architecture

| Zone | Décision | Justification |
|---|---|---|
| Base vitest | service `postgres:16` GitHub (port 5432, db `app_db_ci`) | fiable, healthcheck natif, disjointe du smoke |
| Base smoke | **son propre** Postgres embarqué :55432 (smoke.sh autonome : db:dev + push + seed + dev server) | aucun couplage avec vitest ; zéro maintenance double |
| Schéma test | `drizzle-kit push --force` (idempotent, non-interactif en CI) | réutilise la config existante |
| Lint | `eslint src --max-warnings 0` | rend le résultat T-189 durable (toute régression de warning casse la CI) |
| Pré-chauffage | initdb 240 s avant smoke (smoke n'attend :55432 que 30 s) | le 1er initdb embedded est plus lent que la fenêtre smoke |
| Concurrency | cancel-in-progress par ref | runners gratuits préservés |

## Preuve mesurable exigée
Pas de « config sans effet mesurable » : la validation de T-191 = run
GitHub Actions **vert** observé (`gh run watch`), pas seulement le YAML.

## Incident d'environnement absorpté en entrée de tâche
Snapshot restauré : `.git` local revenu à be30f60 (T-171) avec tout le
travail T-172→T-190 non commité — mais le distant contenait 8548395.
Réalignement par rebase (diff working-tree ↔ 8548395 = vide, rien perdu).
