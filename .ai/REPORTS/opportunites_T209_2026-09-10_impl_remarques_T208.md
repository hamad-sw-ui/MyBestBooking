# Opportunités — T-209

Ces opportunités ont été recherchées conformément au niveau C, mais ne sont pas implémentées automatiquement sauf si elles servent directement les findings T-208.

| Axe | Opportunité | Gain estimé | Coût | Priorité | Décision T-209 |
|---|---|---:|---:|---|---|
| Simplification | Regrouper les flags dans `src/lib/feature-flags.ts` | Moyen | Faible | P2 | Implémenté seulement pour flags nécessaires (`demo`, `payout`, `booking request TTL`). |
| Volume de code | Extraire toute la notification booking dans un service unique | Moyen | Moyen | P3 | Non retenu : limiter le diff, garder l'existant. |
| Performance | Index partiel sur `bookings(request_expires_at)` pour cron | Moyen | Faible | P2 | Retenu avec migration additive si compatible Postgres. |
| Mémoire | Aucun enjeu identifié | Faible | — | P3 | Non retenu. |
| Lisibilité | Contrats no-payment/payout explicités dans API/FEATURES | Élevé | Faible | P1 | Retenu dans la documentation finale. |
| Testabilité | Helpers purs pour TTL/flags | Élevé | Faible | P1 | Retenu. |
| Sécurité | Refus serveur des comptes démo en production hors opt-in | Élevé | Faible | P1 | Retenu. |
| Maintenabilité | Backfill automatique des anciennes demandes pending | Moyen | Moyen | P3 | Non retenu : risque de modifier des données historiques sans demande explicite. |
| UX | Afficher sur les réservations la date d'expiration de demande | Moyen | Moyen | P3 | Non retenu dans T-209 sauf exposition API ; UI dédiée à arbitrer plus tard. |
| Architecture | Table `booking_requests` dédiée | Moyen | Élevé | P3 | Non retenu, trop lourd pour la correction. |
| Observabilité | Logs structurés côté client pour fetchs silencieux | Moyen | Faible | P2 | Retenu en `console.warn` sans PII + état sr-only. |

## Backlog proposé après T-209

- P3 : écran hôte listant explicitement les demandes proches expiration + possibilité de renouveler la demande.
- P3 : route admin de nettoyage/backfill des très anciennes demandes pending si un jour des données de production historiques existent.
- P3 : tableau de bord d'observabilité client plus complet si un collecteur (Sentry/Datadog) est configuré.
