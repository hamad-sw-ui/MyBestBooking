# Tâche courante

- **ID** : T-204
- Titre : Mise en œuvre des remarques de l'audit e-mails (garde P3 + preuves annulation/price-alert)
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

## Nouvelles corrections (audit intégralité + e-mails)

- **P7 — E-mail de confirmation manuelle (corrigé)** : l'e-mail de confirmation
  (voyageur + hôte) n'était envoyé **que** depuis le flux de paiement en ligne
  (`payment-intents.ts`). Quand l'hôte confirme manuellement une réservation
  (T-202/T-203) avec paiement sur place, **aucun e-mail ne partait** (`outbox`
  vide, `confirmation_email_sent_at` NULL). → Corrigé :
  - `PUT /api/bookings/[id] { status:"confirmed" }` appelle désormais
    `sendBookingConfirmationIfNeeded(bookingId)` (best-effort, post-commit).
  - `sendBookingConfirmationIfNeeded` ne conditionne plus l'envoi à
    `paymentStatus === "paid"` : une réservation confirmée avec paiement encore
    `pending` (paiement sur place) reçoit bien son e-mail. La garde s'appuie sur
    `status === "confirmed"` + `confirmationEmailSentAt` (idempotence) + le
    toggle admin `notifications.bookingConfirmation` (désormais respecté).
- **P3 (écran de confirmation, corrigé)** : `reservation-form.tsx` affichait
  « 🎉 C'est confirmé ! » / « Total payé » alors qu'une réservation manuelle est
  encore `pending` + paiement sur place. → Corrigé : quand le POST renvoie
  `manualConfirmation:true`, l'écran affiche « 📩 Demande envoyée » +
  « Montant à régler sur place » + « Un email de confirmation vous sera envoyé ».

## Vérification d'intégralité (audit e-mails)

Test d'intégralité du site (`npm run ci`) + audit runtime de la couche e-mail :
- **Fonctionnels** (envoyés via outbox ConsoleMailer) : vérification email,
  bienvenue (après vérif), oubli mot de passe, rappel J-3/J-1 (cron), demande
  d'avis (cron), confirmation (voyageur + hôte, **désormais aussi en manuel**),
  annulations (voyageur/opérateur/hôte), nouveau message, alerte prix.
- **Preuve runtime** : `booking-confirmation:<id>:guest` +
  `:host` émis (statut `sent`) dès le `PUT status:"confirmed"` ; rappel J3 et
  demande d'avis émis par le cron (`reviewRequestsSent:1`).

## Nouvelles corrections (implémentation des remarques — T-204)

Les commentaires restants de l'audit T-203 (P3 + e-mails non re-testés runtime)
sont implémentés **sans régression** :

- **P3 — Garde UI Stripe (implémenté)** : le flux manuel ne doit **jamais**
  afficher l'UI carte. Décision extraite dans `src/lib/booking-flow.ts` →
  `shouldShowStripeForm` (priorité `manualConfirmation:true` → false, même si le
  serveur renvoyait un `payment`). Appliqué aux deux points d'entrée
  (`handleSubmit` + `resumePaymentFor`). Couvert par `booking-flow.test.ts` (5 cas).
  La machinerie Stripe reste présente (back-office `/api/bookings/[id]/payment`)
  mais est **inatteignable et prouvée** (reprise manuelle → 409).
- **E-mail d'annulation (re-testé runtime)** : `booking-cancellation-mail.test.ts`
  → **2 e-mails réels** (voyageur fr + hôte en, eventKeys distincts).
- **E-mail price-alert (nouveau test runtime)** : `price-alert-mail.test.ts` →
  **1 e-mail fr réel**, idempotent (eventKey unique), status `sent`.

## Gates de fermeture (tous ✅)


- [x] 🔨 `tsc --noEmit` 0 · `eslint src --max-warnings 0` 0
- [x] 🔨 `next build` compiled (64 pages)
- [x] 🔍 `i18n:check` 0 candidat · catalogue **1482** (+3 clés reservation)
- [x] 🧪 `vitest run` **554** (85 fichiers, +8 tests T-203/T-204 ; 17 skip =
  serveur-live `admin/bulk`+`admin/hosts`, **re-testés 17/17 avec serveur actif**)
- [x] ▶️ `npm run smoke` **95/95 PASS** (contrat `pending` + `manualConfirmation`)
- [x] ✅ `npm run ci` **verte** (chaîne complète : typecheck 0 / lint 0 /
  i18n 0 / ai:check 19 OK · 1 warn R7 · 0 fail / vitest 554 / build 64 pages /
  smoke 95/95)
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
