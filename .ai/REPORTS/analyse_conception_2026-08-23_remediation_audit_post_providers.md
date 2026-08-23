# Conception — T-104 remédiation post-providers

## Objectif

Rendre les post-actions financières, pièces jointes, rate plans et contrôles opérateurs effectivement cohérents avec les interfaces déjà livrées.

## Options

### A. Corriger chaque écran localement

Rapide mais crée de nouvelles divergences entre API, cron et dashboard. Rejetée.

### B. Services métier idempotents + migrations additives + UI progressive

- service confirmation booking appelable depuis création et webhook ;
- événements payment/refund explicitement typés ;
- stockage message privé séparé des images publiques ;
- snapshot rate plan sur booking ;
- endpoints de test provider explicitement opt-in.

Avantage : non-régression, testabilité, sécurité. Inconvénient : migration et surface C. **Retenue**.

### C. Déléguer paiement, fichiers et rate plans à un PMS externe

Robuste à terme mais hors périmètre, dépendances produit/contrats absents. Reportée.

## Architecture retenue

```text
booking confirmation service
  ├─ POST booking mock succeeded
  └─ webhook Stripe pending → confirmed
       └─ confirmationEmailSentAt (exactly once)

payment events
  ├─ payment_intent.* → booking status
  └─ refund.* → refundStatus/refundProviderId

message attachment
  ├─ upload privé -> key + attachmentKey
  └─ GET protected attachment -> participant check -> stream / signed URL

rate plan
  ├─ room rate plan selected at checkout
  └─ booking snapshot (id/name/conditions/price) immutable
```

## Compatibilité

- price base remains default with no rate plan ;
- legacy attachment URL is displayed only if existing, new messages use secure key ;
- existing provider configuration remains unchanged ;
- migrations only add nullable/default columns.

## Rollback

Revert code leaves new DB columns unused. Existing bookings, messages and public property images remain available.
