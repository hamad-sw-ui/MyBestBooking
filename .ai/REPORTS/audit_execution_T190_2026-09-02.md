# Audit d'exécution — T-190 (resynchronisation du backlog)

- **Date** : 2026-09-02
- **Déclencheur** : en préparant T-190 (initialement visé : T-161 « alertes
  prix dates passées », listé « à FAIRE » dans le backlog), le code montrait
  la correction **déjà livrée**. Risque identifié : re-implémenter des
  fonctions existantes = la cause de régression la plus probable.

## Méthode

Pour chaque item du backlog « audits 28 & 30 » marqué « à arbitrer »,
vérification croisée code + runtime :

| Item backlog | Preuve code | Preuve runtime (2026-09-02) | Verdict |
|---|---|---|---|
| T-156→159 (audit 28) | section « Audit 29 » = « implémenté + validé » | — | **Livré 2026-08-30** |
| T-160 favoris | `purge-sim-data.mjs`, leftJoin wishlists, `wishlist-utils.test.ts (T-160)` | — | **Livré 2026-08-30** |
| T-161 alertes prix | `isStayPast` + 400 + cron `expirePastStayAlerts` | POST arrivée 2020 → **400** | **Livré 2026-08-30** |
| T-162 i18n vague 2 | `getServerLocale`/`makeT` sur les 5 pages | titles EN : « Privacy policy », « Legal notice » | **Livré 2026-08-30** |
| T-163 partage 404 | `notFound()` dans `generateMetadata` | probe → **404** | **Livré 2026-08-30** |
| T-164 devise SSR | `UiLocaleProvider` amorcé `getServerLocale` | — | **Livré 2026-08-30** |
| T-165 appBaseUrl | `src/lib/app-url.ts` + tests | — | **Livré 2026-08-30** |
| T-166 hygiène runs | purge étendue votes/alertes/wishlists | — | **Livré 2026-08-30** |

## Incidents d'environnement traités dans la même session

Le sandbox avait perdu fichiers non versionnés (`node_modules`, `.data/pg`,
`.next`, `.env.local`) — prod cassée (HTTP 000). Restauration : `npm install`,
recréation `.env.local` (mêmes identifiants sandbox), `db:dev` + `db:push` +
seed démo, rebuild 60/60, cron runner relancé. Le cron répondait 500
(« paiement production exige Stripe ») : valeur `ALLOW_MOCK_PAYMENTS`
corrigée `"1"` → `"true"` (condition stricte `=== "true"`, testée par
`payment/index.test.ts`). Cron de nouveau `ok:true`.

## Modification produit

Aucune (code source inchangé). Mise à jour documentaire : BACKLOG.md
sections Audit 28 & 30 → items barrés avec renvoi aux validations ; je n'ai
PAS touché aux sections T-108→T-112 (« à arbitrer », audit architecture —
hors périmètre T-190 faute d'arbitrage documenté).
