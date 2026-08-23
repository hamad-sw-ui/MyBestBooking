# Analyse d’impact — T-112 conversations uniques

- **Niveau** : S
- **Statut** : en cours

La création select-then-insert peut créer plusieurs fils identiques en cas de
double clic/onglets concurrents. Une clé métier persistée, unique et additive
préserve les fils existants tout en rendant le POST idempotent.

## Invariants

- une conversation booking garde sa clé `booking:<bookingId>`;
- une conversation pré-booking garde `property:<propertyId>:user:<userId>`;
- URLs/conversation IDs historiques restent inchangés;
- host/voyageur/RBAC existants restent appliqués;
- migration backfill avant NOT NULL/UNIQUE.
