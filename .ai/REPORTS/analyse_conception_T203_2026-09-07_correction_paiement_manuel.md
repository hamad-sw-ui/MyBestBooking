# Conception — T-203

- **Problème** : le scénario « paiement manuel » de T-202 est incomplet — aucun
  moyen de constater le paiement sur place (`paymentMethodOffline` jamais `true`,
  `paymentStatus` jamais `paid`), les demandes manuelles expirent à tort après
  15 min, et l'UI propose encore un paiement en ligne inutile.

## Options évaluées

### A. Réutiliser `PUT /api/bookings/[id]` avec un champ d'action payé sur place (retenu)
Étendre la route de mise à jour pour accepter la marque de paiement sur place, en
la réservant à l'hôte/admin du bien. Avantage : réutilise la garde et la
transaction existantes, colocalise la décision avec la confirmation. Inconvénient :
étend le contrat d'une route déjà riche (à faire proprement via une branche
explicite, hors `status`).

### B. Créer une route dédiée `POST /api/bookings/[id]/mark-paid-offline`
Avantage : contrat clair, testable isolément. Inconvénient : duplique la garde
d'authentification et la logique de transaction ; ajoute une route de plus.

**Choix : A** — cohérent avec le pattern existant (la confirmation hôte passe
déjà par `PUT`), moins de surface, plus simple à garder dans le temps.

## Solution retenue

### 1. Non-expiration des demandes manuelles
`POST /api/bookings` : dans la branche `!data.payOnline`, **ne pas renseigner**
`paymentExpiresAt` (laisser `null`). Le cron `expirePendingBookings` (l.47–48)
ajoute une condition `isNotNull(paymentIntentId)` → seules les réservations avec
un hold de paiement réel sont annulées après TTL ; une demande manuelle reste
`pending` jusqu'à décision de l'hôte ou annulation par le client.

### 2. Marquer « payé sur place » (path host/admin)
`PUT /api/bookings/[id]` accepte `paymentStatus:"paid"` (ou un flag booléen
`paymentMethodOffline:true`) via le body. Validation :
- L'acteur doit être l'hôte du bien **ou** admin (`isHost || role==="admin"`).
- La réservation doit être `confirmed` (ou `completed`) et `!== "cancelled"`.
- Si déjà `paid`, ne rien faire (idempotent).
- Effets : `paymentStatus:"paid"`, `paymentMethodOffline:true`,
  `paymentMethod:"offline"`, `paymentExpiresAt:null`.
- Audit : `booking.payOffline` (ajout à `src/lib/audit.ts`).
- Le reste du pipeline (`payout-service`, `dashboard` revenus) filtre déjà
  `paymentStatus==="paid"` → **fonctionne sans modification**.

**Décision clé** : on ne touche PAS au filtrage `paid` de `payout-service` ni de
`dashboard` (non-régression). Le correctif est de rendre l'état `paid` atteignable
manuellement par l'hôte.

### 3. UI
- `BookingRowActions` : bouton **« Payé sur place »** (icône cash) affiché quand
  `canManageStay && status==="confirmed" && paymentStatus!=="paid"` ; badge
  **« Payé sur place »** quand `paymentMethodOffline`.
- Masquer **« Payer maintenant »** pour les bookings manuels (sans
  `paymentIntentId`) : n'afficher le lien de paiement que si un intent/au mode
  `payOnline` existe, sinon afficher une mention « en attente de confirmation ».
- Passer `paymentMethodOffline` (et l'état du paiement) depuis les pages
  `mes-reservations` / `dashboard/bookings/[id]`.

### 4. i18n
Ajouter ~3 clés FR/EN :
- `book.markPaidOffline` (« Marquer payé sur place » / "Mark as paid on site")
- `book.paidOffline` (« Payé sur place » — si `pay.manualConfirmed` existe déjà,
  réutiliser ; sinon ajouter)
- `book.paymentAwaitingHost` (« En attente de confirmation de l'hôte »)
Incrementer le verrou `ui-strings.test.ts`.

## Alternatives écartées
- **Changer le filtre `paid` de `payout-service`** pour inclure les `pending` :
  rejeté — modifierait le calcul des versements et risquerait de verser des
  réservations non payées.
- **Supprimer l'expiration du cron** : rejeté — libère le stock réel des intents
  de paiement ; il ne faut désactiver que pour les demandes sans paiement.
- **Auto-marquer `paid` à la confirmation hôte** : rejeté — le paiement sur place
  doit rester un acte manuel et distinct de la confirmation.

## Migration et rollback
- **Aucune migration DB** : `paymentMethodOffline` et `confirmedBy` existent déjà
  (migration 0019). Seuls les comportements API/UI/cron changent.
- **Rollback** : réverter le commit T-203 → les divergences réapparaissent mais
  sans casse (les comportements reviennent à T-202).

## Sécurité
- La marque « payé sur place » est protégée : hôte du bien **ou** admin uniquement.
- Pas de nouvel endpoint exposé sans authentification.
- Pas de secret ni env var nouvelle.
