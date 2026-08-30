# ADR-009 — Intégrité réservation, paiement et cycle de vie

- **Date** : 2026-08-23
- **Statut** : Acceptée
- **Décideur** : T-102, remédiation audit runtime

## Contexte

L’audit runtime a démontré que le stock journalier et la capacité voyageurs étaient partiellement ignorés, qu’un voyageur pouvait clôturer son séjour et que le checkout confondait réservation créée et paiement confirmé.

## Décision

1. Les règles de séjour (nuits, stock, stop-sell, minStay, capacité et prix journalier) sont des fonctions pures réutilisées puis vérifiées dans la transaction de création.
2. La ligne `rooms` reste verrouillée `FOR UPDATE` pendant la création ; le stock est contrôlé pour chaque nuit du séjour.
3. Un voyageur peut seulement annuler. La clôture dépend d’un hôte après check-out, d’un admin ou de la tâche planifiée.
4. L’avis vérifié exige une réservation clôturée et une date de départ passée.
5. Le paiement Stripe pending n’est jamais affiché comme confirmé. Les données carte passent exclusivement par Stripe Elements. Le mock est interdit en production sans configuration Stripe complète.
6. Annulation, remboursement, cashback et alerte prix reçoivent des marqueurs persistants, afin de permettre les retries idempotents.

## Conséquences

- Les anciennes URLs de checkout sont lues temporairement, mais toutes les nouvelles utilisent la même convention.
- La migration ajoute des colonnes sans supprimer de données.
- Les métriques n’assimilent plus une réservation annulée à un revenu.
- Stripe réel nécessite toujours des clés et une configuration webhook, qui ne sont pas disponibles dans le sandbox ; ce fait reste explicite.

## Alternatives rejetées

- Contrôles uniquement dans le navigateur : contournables.
- Conserver les méthodes de paiement décoratives : trompeur.
- Journal comptable complet dans le même cycle : utile mais modèle légal/payout non défini ; reporté.
