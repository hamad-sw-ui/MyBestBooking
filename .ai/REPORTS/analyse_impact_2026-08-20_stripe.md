# Impact — T-020 : Stripe test-mode (infrastructure)

- **Date** : 2026-08-20 · **Niveau** : **C** · **Ref** : §14

## Quoi
Infrastructure Stripe complète sans commit de credentials :

1. **Abstraction `PaymentProvider`** interface (comme Mailer/Uploader),
   2 adaptateurs :
   - `MockPaymentProvider` (dev/test/sandbox) : simule `create` +
     `webhook signature verification`, marque `paymentStatus:"paid"`
     directement (comportement historique).
   - `StripePaymentProvider` (prod dès `STRIPE_SECRET_KEY` défini) :
     appelle `POST /v1/payment_intents` via fetch, `webhook` vérifie
     la signature `Stripe-Signature`.
2. **`POST /api/bookings`** : au lieu de créer directement `booking`
   avec `paymentStatus:"paid"`, crée d'abord un `payment_intent` via
   le provider et attache `paymentIntentId` au booking (statut
   `pending` jusqu'à réception du webhook).
3. **`POST /api/webhooks/stripe`** : reçoit `payment_intent.succeeded`
   ou `failed`, met à jour le booking.
4. **Page `/reservation/confirmation?intent=...`** : Stripe Elements
   côté client (via `<script src="js.stripe.com/v3">`) OU fallback
   Mock (redirection immédiate).
5. **`bookings.paymentIntentId`** : nouveau champ.

## Où
- Nouveau `src/lib/payment/{types,mock,stripe,index}.ts`.
- Modif `src/db/schema.ts` : ajoute `bookings.paymentIntentId`
  varchar(255).
- Modif `POST /api/bookings` : payment_intent au lieu de "paid" direct.
- Nouveau `src/app/api/webhooks/stripe/route.ts`.
- Modif page `/reservation` : après création booking (pending), redirige
  vers l'URL de checkout Stripe OU affiche succès immédiatement en mode
  Mock.
- `.env.example` : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

## Pourquoi
BUG-003 (paiement mocké) → 🚧 infra prête, 🎯 real prod nécessite
uniquement 3 env vars Stripe test.

## Contrat public
`POST /api/bookings` : sans STRIPE_SECRET_KEY, comportement identique
à avant (paymentStatus:"paid"). Avec, retourne `paymentIntentId` +
`clientSecret` que le front utilise pour Stripe Elements.

## Sécurité
- Webhook : signature `Stripe-Signature` vérifiée avec
  `STRIPE_WEBHOOK_SECRET`.
- Idempotence : `payment_intent.succeeded` reçu 2 fois ne double pas
  le booking.
- `clientSecret` ne quitte jamais le serveur, retourné uniquement au
  voyageur authentifié.

## Tests
- Unitaire : `MockPaymentProvider` OK, `StripePaymentProvider` avec
  factory selon env.
- Manuel : ▶️ POST /api/bookings sans STRIPE_SECRET_KEY → 201
  paid (rétrocompat).

## Rollback
`git revert`. `paymentIntentId` reste en DB, nullable, sans impact.
