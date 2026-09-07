# Analyse de conception — T-195 (versements) + correctifs gaps P1–P4

Date : 2026-09-07. Tâche **S** → exige un rapport de conception (§15.1).
Suivi du modèle `MODELE_analyse_conception.md`.

## Problème
Le versement hôte/admin (T-195, Phase C S1) était livré en interne mais quatre
écarts restants le rendaient incomplet : le cron `/api/cron/payouts` n'était
**jamais déclenché** (route `POST` seule, runner/Vercel en `GET` → 405) ; le
versement n'utilisait **pas la vraie référence** du compte et **ne vérifiait pas
la devise** (`payout.currency` VS `account.currency`) ; le **chemin admin**
renvoyait toujours `projected=[]` (agrégation filtrée sur `adminId`) ; l'audit
de confirmation `payout.paid`/`payout.failed` **n'était pas journalisé**.

## Options évaluées
- **P1** : (a) forcer le runner à `POST` — écart avec le cron Vercel (GET) et
  non-régressif seulement côté runner ; (b) ajouter `export async function GET`
  déléguant au handler partagé + enrichir `vercel.json`. → retenu (b) : un seul
  point de vérité (le handler), le `POST` reste, le runner **et** Vercel
  fonctionnent sans changer leur méthode.
- **P2** : (a) exécuter sans vérification de devise (état antérieur) — rejeté
  (multi-devise = règle métier) ; (b) garde-fou : si devise du payout ≠ devise
  du compte par défaut → `pending` + `skipped[]`, **jamais** exécuté, audit dédié.
  → retenu (b), additif et non-régressif (sans compte, comportement intact).
- **P3** : (a) laisser `createPayoutsForPeriod(admin)` vide (bug) ; (b) itérer
  sur `distinct(hostId)` des lignes (même pattern que le cron) et agréger **par
  hôte**, en insérant avec `draft.hostId` ; ajouter un garde d'appartenance pour
  que l'admin **n'exécute jamais** le versement d'autrui. → retenu (b), chemin
  hôte intact (`isAdmin=false`).
- **P4** : `recordAudit` `payout.paid`/`payout.failed` idempotent dans le
  webhook (après `markPayoutPaidByProviderId`/`markPayoutFailedByProviderId`).

## Solution retenue (additive)
- **P1** : `runPayoutCron(request)` partagé ; `GET` + `POST` ; `vercel.json`
  ajoute `{"path":"/api/cron/payouts","schedule":"0 8 * * *"}`.
- **P2** : `openPayoutAccountReference(account.id)` versé dans `accountRef` ;
  boucle d'exécution : garde d'appartenance (non-propriétaire → `skipped`) puis
  garde **devise** (≠ compte → `skipped`), sinon `executePayout` ; réponse
  `{ created, hasAccount, payouts[], skipped[] }`.
- **P3** : `listProjectedPayouts` et `createPayoutsForPeriod` agrègent **par
  hôte** quand `isAdmin` ; insertion avec `draft.hostId` ; champ `hostId?` sur
  `ProjectedPayout` ; garde d'appartenance dans `POST /api/host/payouts`.
- **P4** : `recordAudit` `payout.paid`/`payout.failed` (idempotent).

## Alternatives écartées
- Forcer le runner en `POST` (P1) — casse la cohérence avec Vercel.
- Supprimer le garde-fou devise (P2) — viole la règle multi-devise.
- Agréger admin sur `adminId` (existant) — bug ; se fier au SQL `1=1` seul —
  incohérent avec `isPayoutEligible`.

## Migration et rollback
- **Migration** : aucune nouvelle migration (la table `payouts`/
  `payout_accounts` est déjà en place via 0018, additive). `vercel.json` : cron
  **additif**. Aucun contrat d'API destructif ; champs `skipped[]`/`hostId?`
  ajoutés, rétro-compatibles.
- **Rollback** : retirer `GET`/`POST` partagé (P1), remettre `accountRef` en
  libellé + sans garde devise (P2), revenir à l'agrégation hôte unique (P3),
  retirer `recordAudit` (P4). Aucune donnée à migrer (ledger idempotent).

## Preuves
🔨 tsc 0 · eslint 0 · i18n 0 · build 62 pages · 🧪 vitest **535/535** ·
▶️ runtime P1 200 / P2 EUR`paid`+XAF `skipped` / P3 admin `projected`=2 /
P4 audit `payout.paid` présent · ✅ ai:check 19 OK · 0 fail.
