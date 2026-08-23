# ADR-011 — Post-actions financières, pièces jointes privées et rate plans

- **Date** : 2026-08-23
- **Statut** : Acceptée
- **Tâche** : T-104

## Décision

1. La confirmation email est déclenchée par un service partagé après capture mock ou webhook, protégé par `confirmationEmailSentAt`.
2. Les événements refund Stripe sont distingués des événements Payment Intent et mettent à jour le remboursement associé.
3. Les nouvelles pièces jointes messages sont stockées privées via `attachmentKey`; un handler vérifie le participant avant lecture. Les URLs legacy ne sont pas servies publiquement.
4. Les rate plans sont sélectionnés au checkout, appliquent leur remise et sont figés dans le booking avec politique/avantages.
5. Le test provider est une action admin explicite ; il ne retourne ni ne journalise un secret.

## Conséquences

- Migration 0010 additive ; données historiques restantes compatibles.
- S3 uploads ne demandent plus `public-read`; les clés `uploads/...` sont supprimables.
- Les promesses BestRewards non réalisables sont retirées de l’interface.
- Les appels réels Stripe/Resend/S3 restent dépendants de credentials de test/production valides.
