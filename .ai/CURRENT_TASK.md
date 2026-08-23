# 🎯 TÂCHE EN COURS

**Tâche :** Orchestrer sans effets externes sous verrou les paiements, notifications et opérations différées révélés par l’audit extrême ; compléter les parcours pagination, calendrier, rate plans et rotation de coffre.
**ID** : T-107
**Niveau** : **C** — paiements, remboursements, secrets, migrations et parcours administrateur/voyageur.
**Statut** : **CORRIGÉ (VALIDÉ)**

## Périmètre

- intent paiement hors transaction, reprise et expiration ;
- succès tardif compensé par remboursement idempotent ;
- outbox fournisseur idempotente ; suppression d’avis avec votes ;
- quote d’alerte contextualisé ;
- count/ordre pagination, navigation calendrier >90 jours et édition rate plan ;
- keyring et procédure de rotation provider.

## Livré et validé

- intent paiement post-commit idempotent, reprise cron et compensation du succès tardif ;
- outbox provider-aware, suppression votes sûre et migration `0013` ;
- quote alerte contextualisé, recherche/calendrier/rate plans complétés ;
- rotation keyring provider sans secret HTTP.

## Preuves

- 🔨 typecheck/build/lint (0 erreur) ;
- 🧪 218/218 ;
- ▶️ migration 0013, webhook/refund tardif, lease outbox, bulk vote, quote,
  PATCH plan et smoke 91/91 ;
- 🔨 `ai:check` à rejouer après synchronisation du HEAD dans STATE/TRACEABILITY.

Les providers externes réels ne sont pas déclarés validés sans clés de test configurées.
