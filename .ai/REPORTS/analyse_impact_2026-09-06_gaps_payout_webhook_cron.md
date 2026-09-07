# Analyse d'impact — Écarts restants après Phase A/B/C (i18n · devises · versements)

Date : 2026-09-06. Base : `docs/analyse_2026-09-06_i18n_devises_payout.md` (référentiel des
remarques), `.ai/REPORTS/validation_T-195_2026-09-06_payouts_webhook.md`, et **vérification
statique du code réel** (grep + lecture des fichiers). Objectif : dire précisément **ce qui n'a
pas été mené jusqu'au bout** et proposer un **plan d'implémentation non régressif**.

Rappel de la chaîne verte actuelle (baseline) : `tsc` 0 · `eslint` 0 · `i18n:check` 0 ·
`vitest` **512/512** (76 fichiers, +17) · `build` 60 pages · `ai:check` 18 OK · 2 warn · 0 fail
· runtime prod prouvé (payout + webhook + sélecteur devise).

---

## 1. Résumé des écarts restants (tableau)

| # | Domaine | Réf | État réel vérifié | Preuve de l'écart |
|---|---|---|---|---|
| **G1** | Phase C · collecte du moyen de versement | plan C2 | ✅ **CORRIGÉ (VALIDÉ)** | `POST/GET /api/host/payout-account` créé (Zod, rate-limit, vaultage AES-GCM, audit, `isDefault` sur 1er compte) ; `getDefaultPayoutAccount()` consulté par `POST /api/host/payouts` ; UI `PayoutAccountForm` montée dans `billing/page.tsx` (masquée si `hasPayoutAccount`). |
| **G2** | Phase C · split/paiement Stripe Connect | plan C3 | 🔵 **BACKLOG (S1, choisi)** | Le provider `payment/stripe.ts` ne fait que `payment_intents`/`refunds` ; **aucun** `transfer_data.destination` ni `application_fee_amount`. Le paiement client reste `payment_intents` simple → la plateforme encaisse tout, `netToHost` reste un **montant calculé / affiché**, non transféré. |
| **G3** | Phase C · cron de versement (ledger auto) | plan C4 | ✅ **CORRIGÉ (VALIDÉ)** | Boucle `["price-alerts","payouts"]` dans `scripts/cron-runner.mjs` ; route `POST /api/cron/payouts` idempotente (`authorized()` + `CRON_SECRET`, `generatePendingPayoutsForPeriod`, surcharge de période pour tests). |
| **G4** | Phase C · UI « Factures » (fin de `invoices=[]`) | plan C5 | ✅ **CORRIGÉ (VALIDÉ)** | `invoices` branché sur `listPersistedPayouts` dans `billing/page.tsx` (G4), badge `invoicesUnavailable` seulement si vide, montant facture en devise native. |
| **G5** | Phase C · sécurité / audit | plan C7 | ✅ **CORRIGÉ (VALIDÉ)** | `payout-account/route.ts` écrit/déchiffre via `sealSecretValue`/`openSecretValue` (AES-GCM, jamais exposé) ; `audit.ts` : `payout.account.create` (+ `payout.request`, `payout.cron`, `payout.paid`/`payout.failed`). |
| **G6** | Phase C · multi-devise d'une période | — | ✅ **CORRIGÉ (VALIDÉ)** | `createPayoutsForPeriod` boucle **un payout par devise** (idempotence `host:period:currency`), `createdCount` fiable ; alias `createPayoutForPeriod` conservé (rétrocompat). |
| **G7** | UI · note `payouts.needConnect` inconditionnelle | — | ✅ **CORRIGÉ (VALIDÉ)** | `billing/page.tsx` consulte `getDefaultPayoutAccount` → note `needConnect` masquée si `hasPayoutAccount` ; formulaire de configuration proposé sinon. |
| **G8** | Docs · `KNOWN_LIMITATIONS.md` | plan §8.4 | ✅ **CORRIGÉ (VALIDÉ)** | Catalogue **1416 → 1452** clés FR=EN (T-194 +1, T-195 +28) ; ligne « Exécution Stripe Connect réelle des versements = INSPECTION » ajoutée ; infra payout interne VALIDÉ / externe INSPECTION documentée. |
| **G9** | Phase A4 · résidus EUR | plan A4 | ⚠️ **partiel assumé** | Wallet (`account-client.tsx`) et `bestrewards-status.tsx` convertis ✅. `promotion-form.tsx:212` (commentaire) et `promo-code-input.tsx:30` (défaut `"EUR"`) **restent EUR** — comportement métier correct (montants promo stockés en EUR), à **documenter** plutôt qu'à convertir. |
| **G10** | Phase C · tests du provider Stripe réel | plan C gates | ❓ **INSPECTION** | `StripePayoutProvider.executePayout` lève `PayoutProviderError` sans clés Connect ; ce chemin **n'est pas exécuté** (§13.5). Honnête : externe = `CORRIGÉ (INSPECTION)`, jamais simulé payé. |

## 2. Détail des preuves (extraits)

- **G1** : `ls src/app/api/host/` → `payouts` uniquement. `grep -rn "getDefaultPayoutAccount|createPayoutAccount" src --include=*.ts --include=*.tsx | grep -v test` → définitions seulement, **aucun appel applicatif**.
- **G3** : `grep -rn "payout" scripts/cron-runner.mjs` → vide.
- **G4** : `src/app/dashboard/billing/page.tsx:91 const invoices: Array<{…}> = …` (statique) ; `:228 {t("billing.invoicesUnavailable")}` ; `:234 {t("billing.invoicesSoon")}`.
- **G5** : `grep -n "payout" src/lib/audit.ts` → vide.
- **G6** : `payout-service.ts` `const first = drafts[0]` → une seule devise.

## 3. Ce qui est bien terminé (pour ne pas refaire)

- **A1/A2** : sélecteurs Langue + Devise montés dans `DashboardSidebar` et `DashboardMobileHeader`.
- **A3** : `check-i18n.mjs` durci (`FRENCH_WORDS` non accentués + lookbehind `(?<!/)` + scan dashboard/managers), `i18n:check` = 0.
- **A4 (partiel)** : wallet + bestrewards convertis à l'affichage.
- **B1–B4** : `sumByCurrencyConverted`/`formatCurrencyConverted` (+ tests), totaux convertis billing/analytics (répartition native conservée), clé `convertedNote`, prix/nuit `properties/[id]` converti.
- **C1** : tables `payouts` + `payout_accounts` (migration additive 0018, appliquée).
- **C6** : webhook `payout.*` (confirmation idempotente `paid`/`failed`, provider mock + Stripe HMAC). ✅ **livré cette session**, prouvé runtime + 5 tests intégration + 12 tests provider.
- **Ledger interne** : `payout-service` (projection 6 mois, persistance, `markPayoutPaidByProviderId`, `markPayoutFailedByProviderId`, `markPayoutProcessing`), route `/api/host/payouts` (GET/POST), bouton, UI « Versements ».

## 4. Plan d'implémentation non régressif (phaseé, gates par étape)

> Principe : chaque brique est **additive**, **aucun contrat existant modifié**, **EUR reste le
> rendu réel**, toutes les conversions restent **à l'affichage** (règle T-132). Gates par étape :
> `tsc` 0 · `eslint` 0 · `i18n:check` 0 · `vitest` vert · `build` ✓ · `ai:check` ✓ · non-régression
> (comparaison `git diff --stat` + ciblée avant/après).

### Étape 1 — G3 : cron ledger de versement (S)
1. Ajouter une tâche `payouts` dans `scripts/cron-runner.mjs` (calquée sur le pattern d'agrégation
   existant) : agrège les bookings `paid` par mois recalé → `createPayoutForPeriod` (idempotent)
   → ne déclenche le provider que si exécution auto autorisée (sinon reste `pending`).
2. Rendre `SECRET`/autorisation identique au cron actuel (token `CRON_SECRET`).
3. Tests : idempotence du tick (exécution ×2 → pas de doublon), créé `pending` si bookings payés.
- **Risque** : nul — lecture seule + création idempotente.

### Étape 2 — G1 + G5 + G7 : gestion du moyen de versement (S, sécurisé)
1. **`POST /api/host/payout-account`** (rôle host/admin) : Zod `{provider, reference, currency,
   displayLabel}`, rate-limit, **vaultage AES-GCM** via `provider-credentials` (`encrypt`/`decrypt`)
   avant écriture, `isDefault` si aucun compte existant, `audit_log` (`payout.account.create`).
2. Route de lecture **`GET /api/host/payout-account`** (jamais le secret : renvoie `displayLabel`,
   `provider`, `status`, `currency`, `isDefault` ; jamais `ciphertext`/`reference`).
3. Dans `POST /api/host/payouts` : **consulter `getDefaultPayoutAccount`** ; si absent →
   réponse claire + UI (renvoi vers la configuration) — corrige G7 (note conditionnelle).
4. `src/lib/audit.ts` : ajouter `payout.account.create` / `payout.request` / `payout.paid` à la
   whitelist `AUDIT_ACTIONS`.
- **Risque** : ne touche pas au paiement ; ajoute un garde-fou (pas d'exécution de versement
  sans account → comportement actuel préservé).

### Étape 3 — G4 : factures réelles (S, affichage)
Brancher `invoices` de `billing/page.tsx` sur un vrai `SELECT` des `payouts` persistés
(`listPersistedPayouts`) ou des bookings facturables, avec statut et `download` (export CSV déjà
présent). Remplacer le `invoices=[]` codé en dur.
- **Risque** : nul (remplace un tableau statique par des données réelles déjà prouvées).

### Étape 4 — G6 : multi-devise d'une période (S, justesse)
Dans `createPayoutForPeriod`, créer **un payout par devise** (boucle sur `drafts`), au lieu de
`drafts[0]`. Renvoyer la liste créée. Idempotence conservée (clé `host:period:currency`).
- **Risque** : faible — change le nombre de lignes créées (un par devise), aucun contrat API public
  cassé (la route renvoie déjà un `payout` ; on l'étend en tableau). Tests ciblés.

### Étape 5 — G8 : documentation (faible, non bloquant)
Mettre à jour `.ai/KNOWN_LIMITATIONS.md` : catalogue 1422→**1441**, ajouter la ligne « versements
: infra interne VALIDÉ (S1), exécution Stripe Connect réelle = INSPECTION (§13.5, clés absentes) ».
Compléter le commentaire sur `promotion-form`/`promo-code-input` (EUR métier assumé).

### Étape 6 — G2 : Stripe Connect (niveau C — structurant, **hors sandbox**)
✅ **Non régresseur** : à ne **PAS** ajouter ici (aucune clé Connect, et S1 choisit délibérément de
ne pas toucher au tunnel de paiement). Documenter comme **évolution prioritaire** (`BACKLOG`) avec
les règles impératives du rapport : sans account actif → comportement actuel préservé ; idempotence
`bookingReference` ; devise compatible sinon refus propre ; `application_fee_amount = commission` ;
`transfer_data.destination = host.stripe_account_id`. **Gates** : uniquement quand les clés test
Connect sont disponibles.

## 5. Critère de fin de plan
À l'issue des **étapes 1–5** (validation réelle 🔨/🧪/▶️), lever `CORRIGÉ (VALIDÉ)` sur la partie
**interne** (cron, account, factures, multi-devise) ; l'**externe** Stripe Connect (G2) reste
`CORRIGÉ (INSPECTION)` documenté. Zéro régression du paiement client et du comportement sans
account Connect actif.
