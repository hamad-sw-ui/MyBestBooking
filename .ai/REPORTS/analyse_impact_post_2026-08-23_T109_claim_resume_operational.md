# Analyse d’impact post-correction — T-109

## Livré

- Le user invité est créé dans la transaction seulement après property/room/règles/promo; la limite est IP avant user.
- `guest_claim` réutilise les tokens hashés et mène à `/activer-compte`, mot de passe puis session réservations.
- `POST /api/bookings/[id]/payment` retrouve/reprend le même intent avec provider retrieve; le checkout traite le 503 comme un hold, non comme une invitation à recréer un booking.
- Vérification/reset/claim utilisent l’outbox avec tentative immédiate; notifications messages sont tentées immédiatement.
- Message dashboard est un lien; route messages applique rate-limit et MIME enregistré upload.
- Stripe accepte plusieurs signatures v1 et ignore les événements hors allowlist.
- Une alerte modifiée réinitialise son curseur de notification.

## Scénarios validés

- request guest invalide : `400`, `orphanUsers=0`;
- guest valide : `201`, pas de session silencieuse, `guestAccessPending=true`, mail claim outbox;
- claim : `200`, cookie session puis GET bookings `200`; token non réutilisable;
- alert context change : `lastNotifiedPrice/At=null`;
- register email verification passe par `email_outbox=sent`;
- Mock retrieve/Stripe multi-signature/type inconnu couverts par Vitest.

## Limites résiduelles

- un intent Stripe réel doit être rejoué avec credentials test; le scénario provider est couvert par abstraction/mock;
- le claim invité doit être explicitement utilisé depuis email; aucun magic-link sans password n’est simulé;
- reporting multi-devise/timezone, settings décoratifs et bornes de dates passent à T-110.
