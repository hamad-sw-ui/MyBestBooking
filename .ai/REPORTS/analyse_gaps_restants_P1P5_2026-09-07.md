# Analyse — écarts restants après implémentation étapes 1–5 (versements)

Date : 2026-09-07 (mise à jour : correctifs **P1–P4 implémentés et validés**). Base :
relecture **du code réel** (grep + lecture des fichiers) puis **validation 🔨/🧪/▶️**.

⚠️ Préambule : `node_modules` n'était pas présent dans le snapshot antérieur (exclu de la
persistance) ; il a été restauré via `npm run env:restore` (T-192), la base embarquée
redémarrée + seedée via `POST /api/seed`, puis la suite complète repliée. Les conclusions
énoncées en **statique** dans ce rapport ont été **confirmées runtime** dans ce tour.

Rappel de la baseline (tour précédent, validée) : `tsc` 0 · `lint` 0 · `i18n:check` 0 ·
`vitest` 520/520 (79 fichiers) · `build` 60 pages · `ai:check` 19 OK · 1 warn · 0 fail ·
preuve runtime (chiffrement AES-GCM roundtrip, un payout par devise, idempotence, expurgation).

---

## 1. Tableau des écarts restants

| # | Zone | État | Preuve (code réel) | Résolution / preuve |
|---|---|---|---|---|
| **P1** | G3 — cron de versement | ✅ **CORRIGÉ (VALIDÉ)** | Avant : `cron-runner.mjs:48` fait `fetch(url,{headers})` **sans method** → `GET` ; `/api/cron/payouts/route.ts` n'exportait **que `POST`** → `405`. `price-alerts` exporte `GET`. Après : route partagée + **`export async function GET`** (runner Vercel/local en GET), `POST` conservé (compat tests), `vercel.json` déclare le cron payouts. | 🧪 test GET idempotent (`cron/payouts/route.test.ts`) · ▶️ runtime `GET /api/cron/payouts` → **HTTP 200** (avant 405). |
| **P2** | G1/G6 — exécution du versement | ✅ **CORRIGÉ (VALIDÉ)** | Avant : `accountRef = "payout_account:<id>"` (libellé), `openPayoutAccountReference` jamais appelé, aucun contrôle devise. Après : `openPayoutAccountReference(account.id)` pour la **vraie référence** + garde-fou devise (`payout.currency` ≠ `account.currency` → `skipped`/`pending`, jamais exécuté), audit `skipped`. | 🧪 `host/payouts/route.test.ts` (compte EUR + booking XAF → XAF skipped) · ▶️ runtime host POST → EUR `paid`, XAF `skipped` (motif « devise incompatible »), XAF reste `pending`. |
| **P3** | chemin admin (multi-hôte) | ✅ **CORRIGÉ (VALIDÉ)** | Avant : `aggregatePayouts(rows,adminId,…)` filtre `hostId!==adminId` → `[]`. Après : agrégation **par hôte** quand `isAdmin` (`listProjectedPayouts` + `createPayoutsForPeriod`), insertion avec `draft.hostId` ; `ProjectedPayout.hostId?` ajouté ; l'admin **ne marque pas payé** les payouts d'autrui (garde d'appartenance). | 🧪 `host/payouts/route.test.ts` (admin projection non vide + POST skip non-propriétaire) · ▶️ runtime admin GET projected = 2, admin POST → `skipped` (motif « réservée à l'hôte propriétaire »), aucun payout marqué payé. |
| **P4** | G5 — audit du paiement | ✅ **CORRIGÉ (VALIDÉ)** | Avant : webhook `markPayoutPaidByProviderId`/`markPayoutFailedByProviderId` sans `recordAudit`. Après : `recordAudit` `payout.paid`/`payout.failed` idempotent dans le webhook. | 🧪 `webhooks/stripe/route.test.ts` (assert audit `payout.paid`) · ▶️ runtime webhook `payout.paid` → `confirmed:true` + audit `payout.paid` présent en DB. |
| **P5** | G9 — résidus EUR | ✅ **fait** | `KNOWN_LIMITATIONS.md:89` liste `promo-code-input`, `promotion-form`. | RAS (déjà documenté). |

---

## 2. Ce qui est bien terminé (ne pas refaire)

- **G1** : `POST/GET /api/host/payout-account` (Zod, rate-limit, vaultage AES-GCM, audit, `isDefault`).
- **G4** : `invoices` branchés sur `listPersistedPayouts` ; montant facture en devise native ;
  export CSV présent.
- **G5 (écriture)** : `sealSecretValue`/`openSecretValue` utilisés pour le stockage, jamais
  exposés en clair ; audits `payout.account.create/update`, `payout.request`, `payout.cron`.
- **G6** : `createPayoutsForPeriod` crée **un payout par devise** (idempotence
  `host:period:currency`, `createdCount` fiable), alias `createPayoutForPeriod` conservé.
- **G7** : note `needConnect` masquée si `hasPayoutAccount` ; `PayoutAccountForm` monté.
- **G8** : `KNOWN_LIMITATIONS.md` catalogue **1452** + ligne « Stripe Connect externe =
  INSPECTION ».
- **Ledger interne** : `payout-service` (projection/persistance/`mark*`), webhook `payout.*`
  idempotent, bouton, UI « Versements ».

---

## 3. Plan d'implémentation non régressif

> Principe : **additif**, aucun contrat public cassé, **EUR reste le rendu réel**, conversions
> **à l'affichage** (T-132). Gates par étape : `tsc` 0 · `lint` 0 · `i18n:check` 0 · `vitest`
> vert · `build` ✓ · `ai:check` ✓ · non-régression (diff ciblé avant/après). Recalculer la
> baseline après `npm install` (node_modules absent du snapshot).

### Étape 1 — P1 : rendre le cron de versement réellement déclenché (S)
1. Dans `/api/cron/payouts/route.ts` : extraire la logique du `POST` dans un handler partagé
   `runPayoutCron(request)`.
2. **Ajouter `export async function GET(request)`** qui délègue à `runPayoutCron` (mêmes
   autorisation-idempotence). Le `POST` continue d'exister (compat tests).
3. Vérifier `vercel.json` : le cron payouts doit être en **GET** (comme price-alerts).
4. Tests : `GET` idempotent (×2 → pas de doublon), même statut/réponse que `POST`.

- **Risque** : nul (on ajoute un verbe ; le `POST` reste). Corrige le `405` silencieux.

### Étape 2 — P2 : exécuter avec la vraie référence et garder les devises séparées (S)
1. Dans `POST /api/host/payouts` : si un **compte par défaut** existe, appeler
   `openPayoutAccountReference(account.id)` pour obtenir la référence réelle (IBAN / `acct_...`)
   et la passer à `executePayout` (fini le libellé `payout_account:<id>`).
2. **Garde-fou devise** : pour chaque payout, si `payout.currency` diffère de
   `account.currency`, **ne pas exécuter** ce payout : le laisser `pending` et renvoyer une
   liste de `skipped[]` avec `{currency, accountCurrency, reason}` (message explicite),
   puis `recordAudit` `payout.request` avec `metadata.skipped`. Sans compte (mock/dev), le
   comportement actuel est **intact** (non-régression).
3. Tests : payout EUR sur compte EUR → exécuté ; payout XAF sur compte EUR → `skipped` +
   status `pending`, aucune exécution, audit `metadata.skipped`.

- **Risque** : faible — ne bloque que l'exécution (pas la signature du ledger), et seulement
  lorsqu'un compte existe. Sans compte, rien ne change.

### Étape 3 — P3 : réparer le chemin admin (un payout par hôte) (S)
1. Ajouter dans `payout-service` une logique d'agrégation **par hôte** lorsque `isAdmin` :
   - soit `aggregatePayouts(rows, hostId, …)` groupé sur le **vrai `hostId` des lignes**
     (remplacer le `hostId` de l'appelant par la valeur `b.hostId`), utilisée par
     `listProjectedPayouts` et `createPayoutsForPeriod` ;
   - soit, plus simple et **non régressif**, itérer sur `distinct(hostId)` des lignes (même
     pattern que `generatePendingPayoutsForPeriod`) et appeler la logique existante par hôte.
2. Corriger `listProjectedPayouts` et `createPayoutsForPeriod` pour produire **un draft/payout
   par (hôte, devise)** quand `isAdmin`, sans toucher au chemin hôte (`isAdmin=false`).
3. Tests : admin → `projected` regroupe toutes les devises de tous les hôtes ; `POST` admin →
   un payout par (hôte, devise) ; **chemin hôte inchangé** (comparaison avant/après).

- **Risque** : le chemin admin renvoie aujourd'hui `[]` (bug) ; le corriger ajoute des données,
  ne casse aucun contrat. **Ne pas modifier le chemin hôte.**

### Étape 4 — P4 : auditer la confirmation du versement (S)
1. Dans `src/app/api/webhooks/stripe/route.ts` : après `markPayoutPaidByProviderId` / fail, faire
   `recordAudit({ action: payoutPaid|payoutFailed, entityType:"payout", entityId: event.payoutId,
   metadata:{ providerPayoutId } })`.
2. Tests : webhook `payout.paid` → audit `payout.paid` ; `payout.failed` → audit
   `payout.failed`.

- **Risque** : nul (ajoute une écriture d'audit idempotente).

### Étape 5 — P5 : documentation (faible)
- Vérifier `KNOWN_LIMITATIONS.md` : ligne déjà présente (`promo-code-input`, `promotion-form`).
  Ajouter, si besoin, une mention explicite du **garde-fou devise (P2)** et du **chemin admin
  multi-hôte (P3)** comme choix assumés une fois implémentés.

---

## 4. Critère de fin

À l'issue des étapes 1–4 (validation 🔨/🧪/▶️) : le cron **déclenche réellement**, le versement
**utilise la vraie référence** avec **garde-fou devise**, le **chemin admin** renvoie les bons
montants, et l'audit `payout.paid/failed` est journalisé. Zéro régression du paiement client
et du comportement **sans compte Connect actif**. L'externe Stripe Connect (G2) reste
`CORRIGÉ (INSPECTION)`.

## 5. Validation réelle (ce tour)

- 🔨 `tsc --noEmit` **0** · `eslint .` **0** · `i18n:check` **0 candidat** · `build` ✓ (62 pages,
  routes `/api/cron/payouts` + `/api/host/payouts` + `/api/webhooks/stripe` présentes).
- 🧪 `vitest run` **535/535** (80 fichiers, 0 skip ; +3 tests P1/P2/P3) — suite complète verte.
- ✅ `ai:check` **19 OK · 1 warn (R7 STATE.md, baseline fin de session) · 0 fail**.
- ▶️ **Runtime (serveur prod, base seedée)** :
  - **P1** `GET /api/cron/payouts` (Bearer CRON_SECRET) → **HTTP 200** (avant 405), `received:true`.
  - **P2** host (compte EUR + booking XAF) → EUR `paid`, XAF `skipped` « devise incompatible »,
    XAF reste `pending` en base.
  - **P3** admin `GET` projected → **2** (avant `[]`) ; admin `POST` → `skipped` « réservée à
    l'hôte propriétaire », aucun payout marqué payé.
  - **P4** webhook `payout.paid` → `confirmed:true` + audit `payout.paid` **n=1** en DB.
  - Nettoyage : base restaurée à la baseline (0 bookings de test, 0 payouts, 0 payout_accounts,
    0 audit payout).

**Non-régression** : le tunnel de paiement client, les contrats API existants et les conversions
à l'affichage (T-132) restent intacts — suite complète verte incluant tous les tests
antérieurs (paiement, propriétés, i18n, devises, wallet, promotions).
