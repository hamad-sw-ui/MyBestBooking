# ADR-013 — Frontières publiques, annulation métier et rotation TOTP

- **Date** : 2026-08-23
- **Statut** : accepté, T-108 en cours

## Décisions

1. Les pages/API publiques retournent seulement des DTO allowlistés; aucun type
   Drizzle complet ne traverse une frontière Server → Client publique.
2. La recherche qualifie une unique room sur tous les critères avant d’afficher
   son prix.
3. Toute annulation passe par une commande métier; les bulk updates bruts sont
   interdits.
4. Les properties avec historique sont archivées et non purgées depuis le bulk.
5. Le TOTP actif n’est jamais envoyé à un tiers ou remplacé avant validation du
   pending secret; setup/disable nécessitent une réauthentification.

## Conséquences

Les migrations sont additives, les historiques restent intacts et les UI
peuvent exiger une copie manuelle du secret TOTP avant qu’un QR local soit
introduit. Les appels PSP/mail restent hors transaction DB.
