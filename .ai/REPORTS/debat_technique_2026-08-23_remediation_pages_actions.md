# Débat technique — T-105

| Rôle | Position | Décision |
|---|---|---|
| UX | aide doit répondre ou ne pas simuler des interactions | articles réels + recherche |
| Juridique/produit | garantie prix sans procédure est risquée | retirer temporairement |
| Finance | email requires outbox | retenu |
| Sécurité | vote et cleanup doivent être DB, pas mémoire | retenu |
| DBA | migrations additives/unique indexes | retenu |
| QA | total recherche et votes doivent avoir tests DB | retenu |
| Ops | cron multi-instance idempotent | états claimés/horodatés |
| Relecteur | ne pas intégrer une facture légale sans règles fiscales | CSV safe seulement |
| Performance | count peut coûter cher | page small/indices, à optimiser ensuite |
| Produit | alert date context vaut mieux que promesse prix vague | retenu avec fallback historique |

## Décision

Services persistants pour les effets externes et retrait des promesses non réalisables. Les tests DB sont obligatoires avant validation.
