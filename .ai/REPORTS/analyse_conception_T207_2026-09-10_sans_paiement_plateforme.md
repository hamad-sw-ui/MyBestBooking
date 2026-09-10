# Analyse de conception — T-207 — Réservations sans paiement plateforme

- **Date** : 2026-09-10
- **Niveau** : C
- **Objectif** : supprimer les parcours de paiement côté voyageur tout en préservant le fonctionnement de réservation, confirmation hôte, annulation, messagerie, comptes invités, règles hôte/admin et QA existante.

## Principe d'architecture

La suppression doit être faite en **défense en profondeur** :

1. **UI** : aucun choix "payer en ligne", aucun formulaire carte/Stripe, aucun bouton "Payer maintenant".
2. **Client** : ne plus envoyer `payOnline:true` ni reprendre `/reservation?booking=...` pour obtenir un paiement.
3. **API** : ignorer les champs legacy (`payOnline`, `useWalletCredits`) et ne plus créer de payment intent.
4. **Routes legacy** : répondre proprement sans divulguer ni ouvrir un paiement.
5. **Wording/légal** : ne plus promettre carte, Stripe, checkout, paiement plateforme, remboursement plateforme ou débit wallet.

## Parcours cible

### Voyageur connecté ou invité

1. Le voyageur trouve un hébergement depuis `/recherche` ou une fiche.
2. Les disponibilités et le devis restent calculés avec les mêmes règles.
3. Sur `/reservation`, il renseigne ses coordonnées et envoie une **demande de réservation**.
4. La demande est créée en `pending`, `manualConfirmation:true`, sans `clientSecret`, sans `paymentIntentId`, avec `payment:null`.
5. L'écran final affiche une demande transmise à l'hôte et un montant estimatif/de référence à régler hors plateforme.
6. Les réservations existantes restent consultables/annulables ; aucune action voyageur ne reprend un paiement.

### Hôte/admin

- L'hôte/admin peut confirmer ou annuler selon les règles existantes.
- La confirmation d'un ancien booking avec intent impayé ne doit pas être bloquée : le champ PSP est neutralisé puis la réservation suit le flux manuel.
- Les éléments pro liés à l'encaissement plateforme sont clarifiés/masqués : pas de setup Stripe voyageur dans settings, pas de demande de versement dans billing.

## Choix techniques

### `reservation-form.tsx`

- Supprimer les états `paymentMethod`, `stripePayment`, `paymentData` et la logique `resumePaymentFor`.
- Retirer l'étape paiement/Stripe et la remplacer par une étape de récapitulatif de demande.
- Conserver la gestion invité/compte, la validation des coordonnées, le calcul quote, l'affichage des règles et l'appel `POST /api/bookings`.
- Envoyer explicitement une demande sans `payOnline:true` et sans consommation wallet.

### `POST /api/bookings`

- Conserver les validations métier, disponibilité, calculs de prix, promos/rate plans et transaction DB.
- Lire les champs legacy uniquement pour ne pas casser un client ancien, mais les ignorer.
- Forcer `paymentIntentId:null`, `paymentStatus:"pending"`, `paymentExpiresAt:null`, `walletCreditsUsed=0`, aucune écriture de payment intent.
- Répondre `payment:null`, `manualConfirmation:true`, `onlinePaymentDisabled:true`.

### `/api/bookings/[id]/payment`

- Garder l'authentification/propriété pour ne pas transformer la route en oracle d'existence.
- Si propriétaire : répondre `410` avec code `ONLINE_PAYMENT_DISABLED`.
- Si non propriétaire : conserver `403`.
- Ne jamais créer/renvoyer de `clientSecret`.

### Stripe côté navigateur

- `/api/providers/stripe` ne renvoie plus de `publishableKey`.
- `StripePaymentForm` devient un stub non interactif sans import Stripe.js/Elements.
- `shouldShowStripeForm` retourne toujours `false` pour que toute réponse legacy contenant `clientSecret` ne réactive pas l'UI.

### Wallet

- Wallet conservé dans le compte comme solde/récompense informatif.
- `useWalletCredits` forgé n'a aucun effet sur la réservation ; pas de débit DB.
- Wording adapté : montant de référence, avantages visibles mais non appliqués dans le tunnel sans paiement plateforme.

### Billing/payout/settings

- Dashboard billing : remplacer la carte de demande de versement par une note indiquant que les montants sont informatifs tant que MyBestBooking n'encaisse pas en ligne.
- Settings admin : masquer la carte Stripe et afficher un avis "paiement en ligne désactivé".
- Routes/webhooks legacy conservées pour compatibilité historique, mais non câblées depuis l'UI voyageur.

## Non-objectifs explicites

- Ne pas supprimer les colonnes DB ni les enums historiques (`paymentStatus`, `paymentIntentId`) pour éviter une migration destructive.
- Ne pas casser les workflows hôte/admin existants : confirmation, annulation, messagerie, modération, comptes invités.
- Ne pas supprimer les factures/exports historiques : leur wording doit indiquer une trace/référence, pas un paiement plateforme en cours.

## Tests de conception

- Test unitaire helper : Stripe form jamais affiché, même avec données legacy.
- Tests API : `payOnline:true` et `useWalletCredits:true` forgés ne créent pas de paiement ni débit wallet ; route payment `410` pour propriétaire ; confirmation legacy neutralise l'intent.
- Tests i18n : clés FR/EN synchronisées.
- Simulations : wallet edge case adapté à un solde informatif non débité.
