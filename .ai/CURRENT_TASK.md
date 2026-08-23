# 🎯 TÂCHE EN COURS

**Tâche :** Corriger les frontières publiques, annulations financières bulk,
archivage administrateur, agrégats d’avis et rotation 2FA révélés par les audits
post T-107.
**ID** : T-108
**Niveau** : **C** — données privées, paiements/remboursements, 2FA et migrations.
**Statut** : **CORRIGÉ (VALIDÉ)**

## Périmètre

- DTO publics/RBAC properties, recherche et avis ;
- status property réservé à l’administration ;
- annulation métier commune bulk/individuelle et archive property ;
- recalcul agrégat avis ;
- TOTP local à deux phases, reauthentification et migration additive.

## Bornes

T-109 (claim invité, reprise paiement, outbox globale, devise/timezone) reste
un chantier C distinct : aucun comportement sera simulé pour le masquer.

## Sortie obligatoire

Migration fraîche, tests RBAC/finance/2FA/recherche négatifs, typecheck, lint,
tests, build, smoke, ai:check et scénarios HTTP. Aucune validation Stripe,
Resend ou S3 réelle sans credentials test.
