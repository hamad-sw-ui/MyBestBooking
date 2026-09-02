# Intégration continue (T-191)

## Locale — reproductible, preuve mesurable immédiate

```bash
npm run ci
```

Joue exactement la chaîne de la CI distante :

1. `tsc --noEmit`
2. `eslint src --max-warnings 0` (zéro warning exigé — héritage T-189)
3. `npm run i18n:check`
4. `npm run ai:check`
5. `vitest run` sur une base **jetable** `app_db_ci_<pid>` (créée +
   schéma poussé + supprimée dans le script)
6. `next build`
7. `npm run smoke` (base embedded dédiée, autonome)

> **Leçon T-187/188/189** : vitest et smoke ne doivent JAMAIS partager
> une base (le smoke mute les données → tests transitoires en échec).
> Le script l'impose structurellement : base jetable pour vitest.

## Distante — GitHub Actions

Le workflow prêt à l'emploi est [`ci-workflow.yml`](./ci-workflow.yml).
Pour l'activer : le copier sous `.github/workflows/` — l'application
GitHub du sandbox n'a pas la permission `workflows` (push refusé), il
faut un push par un utilisateur ou une App autorisée. Les bases y sont
encore disjointes : vitest sur un service `postgres:16` (`app_db_ci`),
smoke sur son Postgres embarqué dédié.
