# Audit d'exécution — T-192 (hygiène documentaire + automatisation sandbox)

- **Date** : 2026-09-02
- **Déclencheur** : en préparant T-192 (initialement « dark mode » — déjà
  livré en **T-029** avec `dark-mode-toggle.tsx` + classe `.dark`), chaque
  piste vérifiée avant implémentation. Inventaire réel : BUGS.md = 0
  ouvert, zéro TODO/FIXME technique, KNOWN_LIMITATIONS partiellement
  obsolète, et la restauration sandbox a MORDU deux fois ce jour (pertes
  de 10+ min chacune).

## Lignes KNOWN_LIMITATIONS vérifiées (probe/code)

| Ligne documentée | Preuve 2026-09-02 | Verdict |
|---|---|---|
| « POST /api/seed public, à protéger en prod » | prod : **404 sans token, 200 avec** | OBSOLÈTE (T-178) → réécrit |
| « Framework : aucun linter, check-ai.mjs pourrait exister » | `scripts/check-ai.mjs` 20 règles, dans `npm run ci` | OBSOLÈTE → réécrit |
| «Pas de vérif manifest vs arborescence» | R2/R4 le font | OBSOLÈTE → réécrit |
| « Quelques `<img>` restants à migrer » | 1 seul : `user-avatar.tsx` (repli initiales via onError, eslint-disable explicite — migration = régression) | OBSOLÈTE → exception documentée |
| « Tests partiels, non stables » | 484/484 isolés ; l'instabilité = ordre smoke→vitest, outillée T-191 | RÉÉCRIT |
| « Suppose Docker pour PG local » | `npm run db:dev` = Postgres **18** embarqué | RÉÉCRIT |
| « `<link>` Google Fonts dans layout.tsx » | **absent** — ni link ni next/font ; Inter/Poppins non chargées (system-ui partout) | RÉÉCRIT (vérité : fallback total) |
| Stripe / rate-limit / cache 60 s / rotation JWT… | choix assumés pertinents | CONSERVÉ |

## Livrable outillage

`scripts/restore-env.sh` (+ `npm run env:restore`) — idempotent :
1. `npm ci` si node_modules absent
2. `.env.local` régénéré si absent — **constantes déterministes sandbox**
   (le vault chiffré CREDENTIALS_ENCRYPTION_KEY reste lisible tant que
   `.data/pg` survit ; bandeau « jamais en production »)
3. PostgreSQL embarqué démarré (setsid) si :55432 libre, attente 240 s
4. `db:push`

Ne gère PAS les process longs (app/cron) — ceux-ci passent par le
gestionnaire de processus (preview Arena). Instructions finales affichées.

## Test du script
- Exécution nom : sauts idempotents corrects (node_modules/env/PG présents).
- Branche de régénération testée en vrai : `.env.local` supprimé →
  régénéré **identique** (diff : +2 lignes d'en-tête voulues, valeurs
  octet-pour-octet identiques). Application restée fonctionnelle
  (vault/session intacts).

## Changement produit : **aucun** (scripts + docs uniquement).
