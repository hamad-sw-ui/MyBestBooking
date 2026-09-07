# Analyse d'impact — T-203

- **Date** : 2026-09-07
- **Tâche** : T-203 — Correction des divergences du scénario « paiement manuel »
- **Niveau** : **S** (structurel, multi-rubriques : lib paiement, route, cron, UI, i18n)

## 1. Objectif

Corriger les 4 divergences qui cassent le bon fonctionnement du flux
« paiement manuel » introduit en T-202, sans régression du pipeline de
paiement en ligne ni du plan approuvé.

## 2. Surface impactée

| Zone | Fichier(s) | Nature du changement |
|---|---|---|
| Création de réservation | `src/app/api/bookings/route.ts` | Ne plus fixer `paymentExpiresAt` en mode manuel (no `payOnline`) |
| Cron d'expiration | `src/app/api/cron/price-alerts/route.ts` | Ne plus annuler les demandes manuelles sans intent |
| Mise à jour d'une réservation | `src/app/api/bookings/[id]/route.ts` | Action hôte `markPaidOffline` → `paymentStatus:"paid"` + `paymentMethodOffline:true` |
| Versements / revenus | `src/lib/payout-service.ts`, `src/app/dashboard/page.tsx` | **Aucun changement de code** — corrigé indirectement (une fois `paid`, le filtrage existant fonctionne) |
| UI actions de réservation | `src/components/booking-row-actions.tsx` | Bouton « Payé sur place » (hôte), badge, masquer « Payer maintenant » |
| Pages alimentant l'UI | `src/app/(main)/mes-reservations/page.tsx`, `src/app/dashboard/bookings/[id]/page.tsx` | Passer `paymentMethodOffline` / état à `BookingRowActions` |
| i18n | `src/lib/ui-strings.ts`, `src/lib/ui-strings.test.ts` | Nouvelles clés FR/EN + verrou catalogue |
| Audit | `src/lib/audit.ts` | Constater `booking.payOffline` (option) |

## 3. Liste des appelants (grep -rn)

- `POST /api/bookings` — appelé par `reservation-form.tsx` (handleSubmit).
- `PUT /api/bookings/[id]` — appelé par `booking-row-actions.tsx`.
- `expirePendingBookings` — appelé par `src/app/api/cron/price-alerts/route.ts`.
- `BookingRowActions` — appelé par `mes-reservations/page.tsx` et `dashboard/bookings/[id]/page.tsx`.
- `createPaymentIntentForBooking` / `resumePaymentIntentForBooking` — appelés par
  `POST /api/bookings` (mode `payOnline`) et `POST /api/bookings/[id]/payment`.

## 4. Risques

1. **Régression du tunnel en ligne** : modifier `POST /api/bookings` pourrait
   affecter le mode `payOnline`. Mitigation : ne toucher au bloc `paymentExpiresAt`
   que sur la branche `!data.payOnline` ; la branche `payOnline` reste inchangée.
2. **Annulation trop agressive ou trop laxiste du cron** : si l'on retire
   entièrement l'expiration, les demandes manuelles ne sont jamais libérées.
   Mitigation : ne pas expirer les bookings `pending` **sans** `paymentIntentId` ;
   celles avec un intent réel (hold) continuent d'être annulées après TTL.
3. **Marquer `paid` sans autorisation** : il faut vérifier que l'acteur est bien
   l'hôte du bien ou l'admin. Mitigation : garde d'autorisation identique à celle
   de la confirmation (`isHost || user.role === "admin"`).
4. **Double compte (revenue)** : un booking `price=0` ou `wallet` ne doit pas être
   compté deux fois. Mitigation : idempotence (si déjà `paid`, ne rien changer).
5. **i18n** : ajout de clés → le verrou du catalogue doit être incrémenté, sinon
   `ui-strings.test.ts` échoue.

## 5. Preuves attendues

- 🧪 Tests unitaires : `POST /api/bookings` (manuel → `paymentExpiresAt` absent),
  `PUT /api/bookings/[id]` (hôte → `paid`+`offline`, 403 non-hôte, 409 déjà payé).
- 🧪 Tests de non-régression : `payment-intents`, `payment-events`, `payout-service`,
  `booking/[id]` (confirm via hôte), `bookings/route` (wallet/total).
- ▶️ Runtime : créer une réservation sans `payOnline` → vérifier `paymentExpiresAt`
  absent ; la confirmer par l'hôte → `confirmedBy` ; la marquer payé sur place →
  `paymentStatus:"paid"`, `paymentMethodOffline:true` ; vérifier le versement.
- 🔨 `tsc`, `lint`, `build`.

## 6. Plan de non-régression

1. Ne **pas altérer** le code Stripe/PSP ni le webhook.
2. Conserver le comportement `payOnline` (bouton « Payer maintenant » → création
   d'intent) : la branche `if (data.payOnline)` reste intacte.
3. Garder le filtrage `paid` existant de `payout-service`/`dashboard` — le correctif
   n'est pas de changer ce filtre mais de permettre d'atteindre l'état `paid`.
4. Rejouer la suite complète : `vitest`, `smoke`, `build`, `ai:check`.
5. Nettoyer la base après les preuves runtime (aucun résidu `T203*`).
