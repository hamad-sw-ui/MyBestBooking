# Validation T-195 — Versements hôtes/admins (Phase C) + webhook `payout.*`

Date : 2026-09-06. Référentiel : règle §13 (chaîne de validation) / §13.5 (limite honnête
sur la partie externe). Objectif : **zéro régression** (paiement client intact, comportement
preservé sans compte Connect actif) et preuve **réelle** (🔨/🧪/▶️) avant arrêt.

## 1. Objet

S1 retenue (cf. `analyse_conception_2026-09-06_dashboard_i18n_devise_payout.md` §4) :
ledger interne `payouts` + `PayoutProvider` (mock/stripe) + UI « Versements » + webhook
`payout.*`. Le **paiement client est intégralement inchangé** (aucune modification du tunnel).

## 2. Découpage interne / externe

| Partie | Périmètre | Statut |
|---|---|---|
| **Interne** | tables `payoutAccounts`/`payouts`, moteur pur d'agrégation/idempotence, `PayoutProvider` (mock), `payout-service`, route `/api/host/payouts`, bouton client, UI billing, **webhook `payout.*` (confirmation ledger)** | **CORRIGÉ (VALIDÉ)** |
| **Externe** | exécution Stripe Connect réelle (onboarding, transfert/SEPA) | **CORRIGÉ (INSPECTION)** — §13.5, clés de test absentes |

La partie externe n'est **pas** simulée comme réussie : `StripePayoutProvider.executePayout`
lève `PayoutProviderError` explicite tant que les clés Connect ne sont pas fournies. C'est la
limite honnête demandée : on ne marque jamais un versement réel comme payé sur une simulation.

## 3. Preuves (tags §16)

### 🔨 typecheck / lint / build
- `npm run typecheck` → **0** erreur.
- `npm run lint` → **0** erreur (0 warning nouveau).
- `npm run build` (`.next` purgé) → **succès**. Routes vérifiées dans la liste de build :
  `/api/host/payouts`, `/api/webhooks/stripe`.

### 🧪 vitest
- `npm test` → **76 fichiers passés, 1 skip ; 512 tests passés, 12 skipped (524 total) ; 0 échec**.
- Dont nouveaux tests :
  - `src/lib/payouts.test.ts` — **8 tests** (moteur pur : agrégation par devise, commission/net,
    idempotence `payoutIdempotencyKey`, `previousMonthRange`).
  - `src/app/api/host/payouts/route.test.ts` — **4 tests** (integration) : customer→403,
    host→200 `paid`, re-POST idempotent (pas de doublon), période invalide→400.
  - `src/lib/payout-provider.test.ts` — **12 tests** (`webhookEventType`, Mock `verifyWebhook`
    normalise paid/failed, Stripe `verifyWebhook` : signature HMAC-SHA256 valide, secret erroné,
    absence de signature, expirée > 5 min, non-payout signé rejeté).
  - `src/app/api/webhooks/stripe/route.test.ts` — **5 tests** (integration) : `payout.paid`
    confirme le versement (idempotent), `payout.failed` le signale, `payout.pending`/
    `in_transit` ne modifie pas, événement inconnu non traité comme payout, payload JSON
    invalide→400.

### ▶️ runtime (serveur de production `next start`)
- Login hôte → `GET /api/host/payouts` → `{projected:[], persisted:[]}` (aucun booking payé).
- Seed d'un booking payé de test (période août 2026) → `GET /projected` retourne
  `gross 200 / commission 30 / net 170 / bookingsCount 1` (agrégation correcte).
- `POST /api/host/payouts {2026-08-01 → 2026-08-31}` → `{created:false, payout:{id,status:"paid"}}`
  (idempotent via mock provider), puis `persisted` contient le payout avec
  `providerPayoutId po_...`, `paidAt` renseigné.
- **Non-régression paiement** : aucun changement du tunnel client ; comportement préservé
  sans compte Connect actif (le provider reste `mock` en dev, `StripePayoutProvider` lève
  sans clés en prod → `ALLOW_MOCK_PAYMENTS=true` exigé pour la démo, règle T-178).
- Nettoyage : seed restauré (0 booking `test.dev`, 0 payout, 0 payout_account).

### 🔍 i18n:check
- `npm run i18n:check` → **0 candidat** (surface UI cohérente). Verrou `ui-strings.test.ts` **1441**.

### 🧠 ai:check
- `npm run ai:check` → **18 OK · 2 warn · 0 fail** (R15 ui_api_coverage, R18 no_dead_ui OK).

## 4. Non-régression (critère bloquant)

- Paiement client : aucun endpoint du tunnel (`POST /api/bookings`, webhooks paiement) modifié.
- Comportement **sans compte Connect actif** : `getPayoutProvider()` retourne le `MockPayoutProvider`
  en dev/test et lève `PayoutProviderError` en prod sans clés (sauf `ALLOW_MOCK_PAYMENTS=true`
  opt-in visible). Aucun faux versement réel.
- Ajout purement **additif** : migration `drizzle/0018_public_edwin_jarvis.sql` (2 tables), aucune
  modification de table existante, aucun contrat API public cassé.

## 5. Limites & suivi

- **Partie externe Stripe Connect** : l'exécution réelle (transfert/SEPA, onboarding Connect)
  exige `STRIPE_SECRET_KEY` + identifiants Connect. Non validable dans ce sandbox → **INSPECTION**.
- Le `StripePayoutProvider.executePayout` reste levée d'erreur tant que les clés ne sont pas
  configurées (protection anti-simulation).
- Le cron automatique (plan §7.4) n'a pas été câblé : la création reste déclenchée par la
  route `/api/host/payouts` (bouton « Demander un versement »). Suivi hors périmètre T-195.

## 6. Fichiers livrés (nouveaux / modifiés)

- `src/db/schema.ts` (+tables `payouts`, `payoutAccounts`), `drizzle/0018_public_edwin_jarvis.sql`.
- `src/lib/payouts.ts`, `src/lib/payouts.test.ts` (moteur pur).
- `src/lib/payout-provider.ts`, `src/lib/payout-provider.test.ts` (abstraction + webhook).
- `src/lib/payout-service.ts` (couche DB : projection, persistance, `markPayoutPaidByProviderId`,
  `markPayoutFailedByProviderId`, `markPayoutProcessing`).
- `src/app/api/host/payouts/route.ts`, `route.test.ts`.
- `src/app/api/webhooks/stripe/route.ts` (branche `payout.*`), `route.test.ts`.
- `src/components/payout-request-button.tsx`.
- `src/app/dashboard/billing/page.tsx` (section « Versements »).
- `src/lib/ui-strings.ts` (+17 clés `payouts.*`), `src/lib/ui-strings.test.ts` (1441).
