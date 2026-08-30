# Opportunités — T-102 : remédiation audit runtime

Les opportunités sont recensées mais ne sont pas ajoutées automatiquement au périmètre C, sauf lorsqu’elles sont indispensables à la correction d’un défaut audité.

| Axe | Opportunité | Gain estimé | Coût | Priorité | Risque |
|---|---|---:|---:|---|---|
| Simplification | Service unique séjour/prix | Évite 3 divergences UI/API | M | P1 | faible |
| Performance | Requête SQL agrégée de disponibilité pour très longs séjours | Réduit charge à grande échelle | M | P3 | moyen |
| Mémoire | Pagination curseur recherches/messages | Réduit chargement listes | M | P2 | moyen |
| Lisibilité | Constantes typées états booking/paiement/remboursement | Moins d’erreurs chaînes | S | P2 | faible |
| Testabilité | Fabrique de données DB de test | Tests intégration plus courts | S | P2 | faible |
| Sécurité | Téléchargement de pièces jointes signé/autorisé | Évite exposition URL publique | M | P1 | moyen |
| UX | Calendrier de sélection visuelle par chambre | Rend disponibilité compréhensible | M | P2 | moyen |
| UX | Vue mobile cartes pour tableaux dashboard | Utilisable sur mobile | M | P2 | faible |
| Architecture | Ledger financier séparé | Reporting/facture/payout exacts | L | P1 | élevé |
| DevOps | Monitoring des crons + alerte échec | Détecte alertes/finalisations perdues | S | P1 | faible |
| Qualité | Playwright en CI avec navigateur préinstallé | Couvre vrais CTA et mobile | S | P1 | faible |

## Décision

Seules les opportunités nécessaires à la sécurité et à la véracité des flux sont intégrées : règles séjour, états remboursement/fidélité, cron idempotent et tests. Les autres restent à arbitrer dans le backlog après validation de T-102.
