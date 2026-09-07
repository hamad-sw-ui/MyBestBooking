# Validation T-203 — Correction des divergences du paiement manuel

Date : 2026-09-07 · Statut : **VALIDÉ**

## Gates (tous ✅)
- 🔨 `tsc --noEmit` → **0 erreur**
- 🔨 `eslint src --max-warnings 0` → **0 erreur / 0 warning**
- 🔍 `i18n:check` → **0 candidat** (catalogue **1479** FR=EN)
- 🔨 `next build` → **Compiled successfully** (64 pages)
- 🧪 `vitest run` → **551/551** (84 fichiers, 0 skip). +5 tests T-203.
- ▶️ `smoke` → **95/95 PASS** (contrat `pending` + `manualConfirmation`)
- ✅ `ai:check` → 19 OK · 0 fail (R7 warn toléré en fin de session)

## Divergences corrigées
1. **Versements/revenus inertes** : le paiement manuel restait `pending` indéfiniment
   et `paymentMethodOffline` jamais `true`. → Un hôte/admin peut **constater le
   paiement sur place** ; le pipeline `payout` (filtre `paid`) fonctionne alors.
2. **Demandes expirées après 15 min** : le cron annulait une demande manuelle sans
   paiement en ligne. → `paymentExpiresAt = null` en manuel + cron limité aux
   bookings avec `paymentIntentId`.
3. **« Payer maintenant » trompeur** pour une demande manuelle. → Masqué, remplacé
   par « En attente de confirmation de l'hôte ».
4. **Aucun bouton/badge « payé sur place »**. → Bouton « Marquer payé sur place »
   (hôte/admin) + badge « Payé sur place ».

## Nouveaux tests
| Test | Fichier | Couvre |
|---|---|---|
| Non-expiration manuelle | `src/app/api/bookings/route.t203.test.ts` | POST sans `payOnline` → `paymentExpiresAt` NULL, `payment:null`, `manualConfirmation:true` |
| Paiement sur place | `src/app/api/bookings/[id]/route.t203.test.ts` | hôte → `paid`+`offline`; idempotent; 403 client; 409 annulé |

## Preuves runtime (serveur :3000, base seedée puis restaurée)
- **Réservation manuelle** : `POST /api/bookings` (connecté, sans `payOnline`) →
  `status:"pending"`, `payment:null`, `manualConfirmation:true`,
  **`paymentExpiresAt:null`**, `paymentIntentId:null`. ✅
- **Confirmation hôte** : `PUT /api/bookings/[id] {status:"confirmed"}` →
  `status:"confirmed"`, `confirmedBy:<hostId>`. ✅
- **Paiement sur place** : `PUT /api/bookings/[id] {markPaidOffline:true}` →
  `paymentStatus:"paid"`, `paymentMethodOffline:true`, `paymentMethod:"offline"`,
  `paymentExpiresAt:null`. ✅
- **RBAC** : client sur `markPaidOffline` → **403** (hôte/admin requis). ✅
- **Idempotence** : re-appel après `paid` → **200**, reste `paid`. ✅
- **Cron** : après `price-alerts`, la demande manuelle `pending` reste `pending`
  (`cancelledAt:null`). ✅
- **Audit** : `booking.pay.offline` tracé (`host:true, manual:true`). ✅

## Correction P7 — E-mail de confirmation manuelle (audit e-mails)
Test d'intégralité (`npm run ci`) + audit runtime de la couche e-mail : la
confirmation ne partait **que** depuis le flux de paiement en ligne ; la
confirmation manuelle (hôte) ne produisait **aucun e-mail**.

- **Avant** : `PUT /api/bookings/[id] {status:"confirmed"}` → `status:"confirmed"`,
  mais `confirmation_email_sent_at` NULL, outbox `booking-confirmation:*` vide.
- **Après** : le PUT confirmé appelle `sendBookingConfirmationIfNeeded(id)` ;
  la fonction ne conditionne plus l'envoi à `paymentStatus === "paid"` (paiement
  sur place encore `pending` à la confirmation) et respecte
  `notifications.bookingConfirmation`.
- **Preuve runtime** : après `PUT {status:"confirmed"}` sur une réservation
  manuelle (paiement encore `pending`), 2 events outbox émis (`status:"sent"`) :
  - `booking-confirmation:<id>:guest` → « Réservation confirmée MBB-… » (client).
  - `booking-confirmation:<id>:host` → « Nouvelle réservation MBB-… » (hôte).
  - `confirmation_email_sent_at` posé. ✅
- **Test** : `src/lib/booking-confirmation.test.ts` (+3 tests : envoi + host/guest,
  idempotence, garde `status:"confirmed"`).

## Correction P3 — Écran de confirmation manuelle (UI)
`reservation-form.tsx` affichait « 🎉 C'est confirmé ! » / « Total payé » pour une
réservation manuelle encore `pending`. → Corrigé : `manualConfirmation:true` →
« 📩 Demande envoyée » + « Montant à régler sur place » + « Un email de
confirmation vous sera envoyé ». (3 clés i18n FR/EN ajoutées.)

## Récapitulatif des changements
- **Backend** : `bookings/route.ts` (paymentExpiresAt conditionnel),
  `cron/price-alerts/route.ts` (cron limité aux intents), `bookings/[id]/route.ts`
  (action `markPaidOffline`), `audit.ts` (+`booking.pay.offline`).
- **UI** : `booking-row-actions.tsx` (bouton + badge « payé sur place », masque
  « Payer maintenant »), `mes-reservations/page.tsx` + `dashboard/bookings/[id]/page.tsx`
  (props `paymentMethodOffline` / `paymentIntentId`).
- **i18n** : +2 clés FR/EN (`book.markPaidOffline`, `book.paymentAwaitingHost`)
  puis +3 clés (`reservation.manualRequestSent`, `.manualRequestBody`,
  `.manualAmountOnSite`) → catalogue **1482**.
- **E-mail** : `booking-confirmation.ts` (déclenchement sur `status:"confirmed"`,
  respect du toggle `notifications.bookingConfirmation`),
  `bookings/[id]/route.ts` (appel `sendBookingConfirmationIfNeeded` après
  confirmation manuelle), `reservation-form.tsx` (écran manuel).
- **Aucune migration DB** : champs `paymentMethodOffline`/`confirmedBy` existants
  (migration 0019). **Aucune modification du tunnel Stripe/PSP ni du webhook.**

## Base restaurée
Après tests, base revenue à l'état seed : **8 propriétés**, **1 hôte démo
`approved`**, **0 réservation de test**.
