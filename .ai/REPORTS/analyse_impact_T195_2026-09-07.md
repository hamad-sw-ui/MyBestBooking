# Analyse d'impact — T-195 (versements hôtes/admins) + correctifs gaps P1–P4

Date : 2026-09-07. Tâche **S** → exige un rapport d'impact (§14) et de conception (§15.1).
Référentiel : `docs/analyse_2026-09-06_i18n_devises_payout.md`,
`.ai/REPORTS/analyse_impact_2026-09-06_gaps_payout_webhook_cron.md`,
`.ai/REPORTS/analyse_gaps_restants_P1P5_2026-09-07.md`.

## 1. Périmètre (additif, sans régression)

La fonction « Versements » (T-195, Phase C S1) livre un **ledger interne** :
`payouts` + `payout_accounts` (migration additive **0018**), `PayoutProvider`
(mock/dev + Stripe si clés), UI « Versements », webhook `payout.*` idempotent,
cron `/api/cron/payouts`, route `POST/GET /api/host/payouts` et
`POST/GET /api/host/payout-account`. Le **paiement client est intégralement
inchangé** : aucun `transfer_data`/`application_fee_amount` n'est ajouté au
tunnel (G2 = BACKLOG, clés Connect absentes).

## 2. Correctifs des écarts restants (P1–P4)

| # | Écart (avant) | Impact | Correctif (après) | Risque |
|---|---|---|---|---|
| **P1** | `/api/cron/payouts` n'exporte que `POST` ; runner local **et** cron Vercel déclenchent en `GET` → **405** en continu. | Le cron de versement **ne tournait jamais**. | Handler partagé + **`export async function GET`** (délègue au `POST`) ; `POST` conservé ; `vercel.json` déclare `/api/cron/payouts`. | Nul (ajout d'un verbe). |
| **P2** | `POST /api/host/payouts` passait `accountRef = "payout_account:<id>"` (libellé) ; jamais `openPayoutAccountReference` ; aucun croisement `payout.currency` vs `account.currency`. | Versement possible en **devise ≠ compte** → violation de « ne jamais mélanger les devises ». | `openPayoutAccountReference(account.id)` pour la **vraie référence** (IBAN/`acct_...`) + **garde-fou devise** : devise ≠ compte → `pending` + `skipped[]` (jamais exécuté) + audit `skipped`. | Faible (ne bloque que lorsqu'un compte existe ; sans compte, comportement intact). |
| **P3** | `aggregatePayouts(rows, adminId, …)` filtre `b.hostId !== adminId` → **`projected=[]`** pour admin ; `POST` admin → 404. | Admin ne voyait/jamais créait de versements multi-hôtes. | Agrégation **par (hôte, devise)** quand `isAdmin` (`listProjectedPayouts` + `createPayoutsForPeriod`, insertion avec `draft.hostId`) ; `ProjectedPayout.hostId?` ajouté ; l'admin **n'exécute jamais** le versement d'autrui (garde d'appartenance → `skipped`). | Nul pour le chemin hôte (inchangé) ; admin corrige un `[]` → données ajoutées. |
| **P4** | Webhook marquait `paid`/`failed` sans `recordAudit`. | Aucune trace d'audit de la confirmation. | `recordAudit` `payout.paid`/`payout.failed` (idempotent) dans `/api/webhooks/stripe`. | Nul (écriture d'audit idempotente). |
| **P5** | `promotion-form`/`promo-code-input` en EUR. | — | Déjà documenté (comportement métier, montants promo stockés en EUR). Aucun code. | — |

## 3. Non-régression

- **Tunnel de paiement client** : aucun fichier de `src/lib/payment` ni de flux
  `payment_intent`/`refund` modifié. `vercel.json` : ajout d'un cron **additif**.
- **Contrats API** : `GET /api/host/payouts` renvoie toujours `{projected, persisted}` ;
  `POST` renvoie `{created, hasAccount, payouts}` (champs **ajoutés** `skipped[]`,
  rétro-compatibles) ; `POST/GET /api/host/payout-account` renvoie les mêmes
  champs expurgés.
- **Conversions à l'affichage (T-132)** : aucune conversion de devise modifiée ;
  les montants de versement restent en devise native du payout (jamais de somme
  inter-devises).
- **Comportement sans compte Connect** : sans compte, `POST /api/host/payouts`
  conserve le repli mock/dev (`hasAccount:false`, `accountRef='host:<id>'`).

## 4. Validation réelle

🔨 `tsc` 0 · `eslint` 0 · `i18n:check` 0 (catalogue **1452**) · `build` 62 pages.
🧪 `vitest run` **535/535** (80 fichiers, 0 skip ; +3 tests P1/P2/P3).
▶️ **Runtime (serveur prod, base seedée)** :
- P1 `GET /api/cron/payouts` → **HTTP 200** (avant 405), `received:true`.
- P2 hôte (compte EUR + booking XAF) → EUR `paid`, XAF `skipped` « devise
  incompatible », XAF reste `pending`.
- P3 admin GET `projected` = **2** (avant `[]`) ; admin POST → `skipped`
  « réservée à l'hôte propriétaire », aucun payout marqué payé.
- P4 webhook `payout.paid` → `confirmed:true` + audit `payout.paid` **n=1**.
- Base restaurée à la baseline (0 résidu bookings/payouts/payout_accounts/audit).
✅ `ai:check` 19 OK · 0 warn · 0 fail.

## 5. Limite connue

**Externe** Stripe Connect (création account/onboarding/`transfer` réels) =
`CORRIGÉ (INSPECTION)` (§13.5) : `StripePayoutProvider.executePayout` lève
sans clés Connect — jamais simulé payé. À re-valider avec un compte Connect de
test avant ouverture production (voir `KNOWN_LIMITATIONS.md`).
