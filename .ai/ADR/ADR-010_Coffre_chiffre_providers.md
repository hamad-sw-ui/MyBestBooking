# ADR-010 — Coffre chiffré de configuration providers

- **Date** : 2026-08-23
- **Statut** : Acceptée
- **Tâche** : T-103

## Décision

Les configurations Stripe, Resend et S3 enregistrées depuis l’administration sont stockées par champ dans `provider_credentials`, chiffrées AES-256-GCM. La clé maître `CREDENTIALS_ENCRYPTION_KEY` est fournie uniquement par l’environnement du serveur.

Les interfaces et endpoints n’exposent jamais les valeurs : seulement provider, champs présents, source et date. Les variables `.env` restent un fallback pour compatibilité et bootstrap. Un admin peut retirer les overrides DB afin de revenir à l’environnement.

## Conséquences

- Les factories mail/paiement/upload sont asynchrones et résolvent d’abord la DB chiffrée puis l’environnement.
- Sans master key, l’administration peut observer l’état mais ne peut pas écrire en clair.
- La perte de la master key rend les overrides DB illisibles : elle doit être sauvegardée/rotée comme un secret d’infrastructure.
- Les providers non intégrés ne reçoivent pas de formulaire décoratif ; leur ajout nécessite un consumer runtime et une analyse C.
