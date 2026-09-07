# Tâche courante

- **ID** : T-195
- Titre : Versements hôtes/admins (Phase C, S1) + webhook `payout.*` +
  correctifs gaps P1–P4 (cron réel, garde-fou devise, chemin admin, audit)
- **Statut** : CORRIGÉ (VALIDÉ) ✅
- **Niveau** : **S**

## Description
Ledger `payouts`/`payoutAccounts` (migration additive 0018), `PayoutProvider`
(mock/stripe, limite honnête §13.5), UI « Versements », webhook `payout.*`
idempotent. Puis correction des écarts restants (rapport
`analyse_gaps_restants_P1P5_2026-09-07.md`) :
- **P1** — `/api/cron/payouts` déclenché en **GET** (runner local + cron Vercel),
  `POST` conservé, `vercel.json` enrichi.
- **P2** — exécution avec la **vraie référence** (`openPayoutAccountReference`)
  + **garde-fou devise** (devise ≠ compte → `pending`/`skipped`, jamais transféré).
- **P3** — **chemin admin** réparé : agrégation par (hôte, devise), l'admin
  n'exécute jamais le versement d'autrui.
- **P4** — audit `payout.paid`/`payout.failed` journalisé par le webhook.
Paiement client intégralement inchangé (zéro régression sans compte Connect actif).

## Sprint de fermeture (tous ✅)
- [x] 🔨 tsc 0 · eslint 0 · i18n:check 0 (catalogue **1452**) · build 62 pages
- [x] 🧪 vitest **535/535** (80 fichiers, 0 skip)
- [x] ▶️ runtime prod : `GET /api/cron/payouts` → 200 (avant 405) ; hôte compte
  EUR + booking XAF → EUR `paid` / XAF `skipped`/`pending` ; admin GET
  `projected` = 2 (avant `[]`) ; admin POST → `skipped` (non-propriétaire) ;
  webhook `payout.paid` → audit `payout.paid` présent ; base restaurée baseline.
- [x] ✅ ai:check 19 OK · 0 fail · R7 STATE.md synchronisé
- [x] Partie **externe** Stripe Connect → **CORRIGÉ (INSPECTION)** (§13.5).

## Précédentes tâches
- T-194 — Accès démo en un clic (`/connexion`) — **VALIDÉ** ✅
- T-193 — `npm run site:audit` (audit runtime, 0 issue) — **VALIDÉ** ✅
- T-192 — KNOWN_LIMITATIONS purgé + env:restore — **VALIDÉ** ✅

## Prochaine
- **ID** : G2 (BACKLOG) — split/paiement Stripe Connect externe
  (`transfer_data.destination`/`application_fee_amount`) — **hors sandbox**,
  à traiter uniquement lorsque des clés Connect de test sont disponibles.
- Reste à décision utilisateur : activer le workflow GHA (permission) ;
  arbitrer T-108→T-112 ; polices auto-hébergées si CDN accessible.
