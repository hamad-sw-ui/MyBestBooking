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

## Checklist de mise en production (audit n°6)

| Point | Règle |
|---|---|
| `NEXT_PUBLIC_APP_URL` | **Obligatoire** : c'est la base des liens d'e-mails, de `robots.txt`, du sitemap et de `metadataBase`. Sans elle, `appBaseUrl()` (`src/lib/app-url.ts`) retombe sur `https://mybestbooking.com` et journalise un avertissement unique — jamais de lien relatif/localhost (`src/lib/app-url-usage.test.ts` verrouille la règle). |
| `CRON_SECRET` | Obligatoire en production : sans lui, les crons répondent 401 et `/dashboard/cron` passe en `missing`. La planification vit dans `vercel.json` (`price-alerts`, quotidien 08:00 UTC) et la cadence attendue dans `CRON_SCHEDULES` (`src/lib/cron-trace.ts`) — les deux doivent rester alignés (`src/lib/cron-schedule.test.ts`). |
| Rate-limit | Le limiteur est **en mémoire** : au-delà d'une instance, la limite effective est divisée par le nombre d'instances. Prévoir un stockage partagé (Redis) avant de passer à plusieurs instances. |
| Purge technique | `purgeTechnicalData()` (cron) : sessions expirées > 7 j, `email_outbox` > 90 j, `cron_runs` > 90 j. Vérifier l'état sur `/dashboard/cron`. |

## Distante — GitHub Actions

Le workflow prêt à l'emploi est [`ci-workflow.yml`](./ci-workflow.yml).
Pour l'activer : le copier sous `.github/workflows/` — l'application
GitHub du sandbox n'a pas la permission `workflows` (push refusé), il
faut un push par un utilisateur ou une App autorisée. Les bases y sont
encore disjointes : vitest sur un service `postgres:16` (`app_db_ci`),
smoke sur son Postgres embarqué dédié.
