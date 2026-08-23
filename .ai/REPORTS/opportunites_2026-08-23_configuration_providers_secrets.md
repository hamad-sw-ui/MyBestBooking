# Opportunités — T-103 configuration providers

| Opportunité | Gain | Coût | Priorité | Décision |
|---|---:|---:|---|---|
| Rotation de `CREDENTIALS_ENCRYPTION_KEY` avec double chiffrement | sécurité haute | L | P1 | Backlog : exige procédure de transition |
| Intégration Vault/Cloud Secret Manager | sécurité/ops haute | L | P2 | Backlog, dépend fournisseur |
| Test de connexion Resend/S3/Stripe depuis UI | UX admin | M | P2 | Non inclus : risque d’actions externes, à concevoir par provider |
| Historique de versions secret sans valeur | audit | M | P2 | Backlog |
| Support provider supplémentaire | produit | M | P2 | Ajouter uniquement avec consumer runtime et schéma dédié |

Aucune de ces opportunités n’est incluse automatiquement hors du coffre et de l’UI nécessaires à la demande.
