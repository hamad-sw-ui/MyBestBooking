# Tâche courante

- **ID** : T-203
- Titre : Correction des divergences du scénario « paiement manuel » (fiabilisation bout-en-bout)
- **Statut** : IMPLEMENTÉ (VALIDÉ) ✅
- **Niveau** : **S**

## Contexte

T-202 (validation hôte + paiement manuel) est implémenté et validé. La revue
approfondie du scénario a révélé **4 divergences** qui cassaient le bon
fonctionnement du flux « paiement manuel ». Toutes sont corrigées et prouvées.

1. **Versements/revenus jamais déclenchés** : une réservation manuelle restait
   `paymentStatus:"pending"` indéfiniment et `paymentMethodOffline` n'était jamais
   `true` → aucun versement. → Corrigé : un hôte/admin peut désormais **constater
   le paiement sur place** (`PUT /api/bookings/[id] { markPaidOffline: true }` →
   `paymentStatus:"paid"` + `paymentMethodOffline:true`). Le pipeline `payout`
   (filtre `paid`) fonctionne alors **sans modification**.
2. **Demandes expirées après 15 min** : `POST /api/bookings` fixait
   `paymentExpiresAt` même sans paiement et le cron annulait la demande.
   → Corrigé : `paymentExpiresAt = null` en mode manuel et le cron
   `expirePendingBookings` n'annule que les bookings avec un `paymentIntentId`.
3. **UI « Payer maintenant » trompeuse** : proposée pour une demande manuelle.
   → Corrigé : masquée si aucun intent (`paymentIntentId`), remplacé par
   « En attente de confirmation de l'hôte ».
4. **Pas de bouton/badge « payé sur place »** → Corrigé : bouton « Marquer payé sur
   place » (hôte/admin) + badge « Payé sur place » quand `paymentMethodOffline`.

## Corrections livrées (par lot, toutes vertes)

- **J1** — Non-expiration des demandes manuelles (`POST /api/bookings` +
  `expirePendingBookings`).
- **J2** — Action hôte « payé sur place » (`PUT /api/bookings/[id]` +
  audit `booking.pay.offline`).
- **J3** — UI : bouton « Marquer payé sur place » + badge « Payé sur place » +
  masquer « Payer maintenant » pour les manuels.
- **J4** — i18n : +2 clés (`book.markPaidOffline`, `book.paymentAwaitingHost`),
  catalogue 1477 → 1479.
- **J5** — Tests : `route.t203.test.ts` (non-expiration) +
  `[id]/route.t203.test.ts` (pay offsite, 403, 409, idempotence) → +5 tests.

## Gates de fermeture (tous ✅)

- [x] 🔨 `tsc --noEmit` 0 · `eslint src --max-warnings 0` 0
- [x] 🔨 `next build` compiled (64 pages)
- [x] 🔍 `i18n:check` 0 candidat · catalogue **1479**
- [x] 🧪 `vitest run` **551/551** (84 fichiers, 0 skip) — +5 tests T-203
- [x] ▶️ `npm run smoke` **95/95 PASS** (contrat `pending` + `manualConfirmation`)
- [x] ✅ `ai:check` 19 OK · 0 fail (R7 warn toléré en fin de session)

## Preuves runtime (serveur :3000, base seedée puis restaurée)

- `POST /api/bookings` (connecté, sans `payOnline`) → `status:"pending"`,
  `payment:null`, `manualConfirmation:true`, **`paymentExpiresAt:null`**,
  `paymentIntentId:null`.
- `PUT /api/bookings/[id] {status:"confirmed"}` par l'hôte → `status:"confirmed"`,
  `confirmedBy:<hostId>`.
- `PUT /api/bookings/[id] {markPaidOffline:true}` par l'hôte →
  `paymentStatus:"paid"`, `paymentMethodOffline:true`, `paymentMethod:"offline"`,
  `paymentExpiresAt:null`.
- `PUT` `markPaidOffline` par le client → **403** (hôte/admin requis).
- Re-appel `markPaidOffline` après `paid` → **200** idempotent (reste `paid`).
- Cron `price-alerts` lancé : la demande manuelle `pending` reste `pending`
  (non annulée, `cancelledAt:null`).
- `audit_log` : `booking.pay.offline` tracé (`host:true, manual:true`).
- Base restaurée : 8 propriétés seed, 1 hôte démo `approved`, 0 réservation test.

## Précédentes tâches

- T-202 — Validation hôte + paiement manuel — **IMPLEMENTÉ (VALIDÉ)** ✅
- T-195 — Versements hôtes/admins + gaps P1–P9 — **CORRIGÉ (VALIDÉ)** ✅
- T-194 — Accès démo en un clic — **VALIDÉ** ✅
