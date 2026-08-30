# Conception — T-109

## Claim invité

`verification_tokens` est réutilisée avec purpose `guest_claim`, hash SHA-256,
TTL 24 h et consumption unique. Le user invité est inséré dans la transaction
booking seulement après validation des règles prix/stock/promo. Le mail utilise
l’outbox et ouvre `/activer-compte`; ce parcours définit un mot de passe puis
crée une session et conserve les bookings liés au même userId.

## Reprise paiement

`POST /api/bookings/[id]/payment` applique la même autorisation que le détail,
relance uniquement `createPaymentIntentForBooking` pour un hold sans intent, ou
retrouve l’intent existant via le provider. L’UI peut revenir au Stripe Element
sans créer un second booking. Le client ne choisit jamais montant/devise.

## Autres effets

- Resend/webhook : toutes signatures HMAC v1 et allowlist payment/refund.
- Messages : destination dashboard explicitement navigable, rate-limit, MIME
  déterminé depuis `upload_objects`.
- Alertes : mise à jour contextuelle réinitialise le curseur de notification.

## Alternatives rejetées

- session invité durable avant email : confusion de sécurité et appareils partagés ;
- token booking dans URL brute : fuite référent de réservation ;
- créer une nouvelle réservation à chaque retry : hold/inventaire et idempotence cassés ;
- webhook permissif : inbox polluée et événements non métier persistés.
