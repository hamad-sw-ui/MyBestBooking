# Débat technique — T-104

| Rôle | Recommandation | Objection / décision |
|---|---|---|
| Sécurité | pièces jointes privées, URL signées/handler participant | retenu ; URL publique aléatoire ne suffit pas |
| Finance | idempotence email/refund par marqueurs persistants | retenu ; webhook retry ne doit pas doubler |
| PostgreSQL | snapshots rate plan dans booking | retenu ; ne jamais recalculer historique |
| QA | tests webhook/refund/S3 remove/range prix | retenu avant validation |
| UX | test provider explicite, pas automatique | retenu ; action admin consentie |
| Performance | ne pas appeler provider sur chaque rendu | retenu ; test seulement bouton admin |
| Produit | perks non supportés doivent être retirés/qualifiés | retenu : formulation honnête d’abord |
| Architecte | services partagés plutôt que patch UI | retenu |
| DevOps | S3 test doit supprimer l’objet même en erreur | retenu avec cleanup best-effort |
| Relecteur | pas d’affirmation Stripe réelle sans clés | retenu, limite maintenue |

## Décision

Migrations additives et services idempotents ; sécurité des fichiers et finance passent avant ajouts marketing. Les tests fournisseur réels restent conditionnés à des clés test, mais les appels/mocks sont vérifiés sans secret.
