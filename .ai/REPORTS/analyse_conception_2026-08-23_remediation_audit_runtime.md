# Conception — T-102 : remédiation de l’audit runtime

- **Date** : 2026-08-23
- **Niveau** : C — critique
- **Prérequis** : `analyse_impact_2026-08-23_remediation_audit_runtime.md`

## 1. Objectif

Rendre les engagements produits exécutables et cohérents : une réservation doit respecter chambre/stock/séjour, un paiement doit refléter son état réel, un avis doit correspondre à un séjour terminé et les actions visibles doivent atteindre leur backend.

## 2. Contraintes

- Next.js 16 App Router, PostgreSQL et Drizzle ;
- contrats API déjà appelés par les pages ;
- données historiques et seed à préserver ;
- pas de carte bancaire traitée directement par le serveur ou un `<input>` maison ;
- environnement local sans clés PSP réelles, mais mock indispensable aux tests ;
- cron déclenchable sur Vercel et testable manuellement de façon authentifiée.

## 3. Solutions considérées

### Option A — Corrections locales dans chaque route/page

**Principe** : ajouter les `if` de capacité dans `/api/bookings`, corriger le lien, masquer les boutons et ajuster les pages séparément.

- Avantages : diff initial court, peu de nouveaux fichiers.
- Inconvénients : recherche, fiche et checkout divergent à nouveau ; prix/calendrier seraient recalculés plusieurs fois ; tests de concurrence fragiles.
- Sécurité : chaque nouveau appelant risque d’oublier une règle.
- Maintenabilité : faible ; c’est précisément la cause de l’audit.

**Décision** : écartée.

### Option B — Service métier central + migrations additives + UI adaptatrice

**Principe** : isoler les règles pures de séjour et de capacité, les réutiliser dans l’API transactionnelle, puis exposer un devis. Ajouter les états financiers/fidélité nécessaires sans supprimer les colonnes historiques. Les pages deviennent des consommateurs du contrat unique.

- Avantages : une même vérité pour recherche/fiche/checkout ; tests unitaires rapides et tests DB ciblés ; compatibilité progressive ; transparence de paiement.
- Inconvénients : plus de fichiers et une migration ; il faut documenter les états.
- Performance : boucle sur les nuits du séjour, bornée par la validation de durée ; index room/date et room/checkin/checkout déjà présents.
- Sécurité : vérifications finales dans transaction et actions financières idempotentes.
- Maintenabilité : élevée.

**Décision** : retenue.

### Option C — Réservation externalisée complète vers une plate-forme tierce

**Principe** : déléguer inventaire, paiement, fidélité et facturation à un PMS/OTA/PSP enrichi.

- Avantages : processus financier mature à terme.
- Inconvénients : changement d’architecture, coût, migration de données, perte de contrôle ; ne corrige pas à court terme les boutons et permissions existants.
- Impact : très élevé, sans validation contractuelle disponible.

**Décision** : écartée du présent cycle ; peut être une étude produit ultérieure.

## 4. Solution retenue

### 4.1 Réservation et disponibilité

Créer `src/lib/booking-rules.ts` avec fonctions pures :

- énumération sûre des nuits `[checkIn, checkOut)` ;
- validation de capacité adultes/enfants/total ;
- décision de disponibilité par nuit depuis `rooms.quantity`, override `availableCount`, `stopSell`, bookings existants ;
- `minStay` évalué pour la date d’arrivée ;
- prix journalier : override ou prix de base.

`POST /api/bookings` garde le verrou de chambre, charge les disponibilités et les chevauchements, appelle ce moteur, puis crée la réservation. La même fonction alimente le devis et les résultats contextualisés.

### 4.2 Paiement et annulation

Le provider expose création et remboursement. Les réservations mock restent confirmées pour le développement. Une réservation Stripe non terminée reste `pending` et l’interface ne dit jamais qu’elle est payée. Stripe Elements est utilisé uniquement si clé publique et client secret sont disponibles.

Les colonnes additives enregistrent remboursement et attribution fidélité. Une annulation calcule les frais, tente le remboursement quand nécessaire et laisse un état explicite si cela échoue. Reporting utilise le montant encaissé net de remboursement.

### 4.3 Cycle de vie et fidélité

Les transitions sont autorisées par acteur : voyageur = annulation, hôte/admin = clôture après check-out, tâche cron = clôture automatique. L’attribution BestRewards/cashback est déclenchée une seule fois lors de la clôture grâce à un marqueur booking. Un avis nécessite une réservation clôturée à la date correcte.

### 4.4 Parcours UI

- Une seule URL checkout, avec lecture legacy temporaire.
- `PropertyBookingCard` client garde dates/voyageurs et construit le lien.
- `/reservation` n’est plus bloquée pour un invité ; l’API reste la protection métier.
- Actions réservation créent/ouvrent une conversation ; les pièces jointes sont rendues.
- Wishlist peut devenir publique/privée et régénérer un lien.
- Les alertes sont honnêtes puis réellement évaluées par un cron protégé.

## 5. Risques

| Risque | Niveau | Réduction |
|---|---|---|
| Incohérence entre paiement Stripe et webhook | Critique | écran pending, polling GET, webhook idempotent, aucune confirmation optimiste |
| Remboursement double | Critique | `refundStatus` persistant, provider appelé seulement pour une transition éligible |
| Double attribution fidélité | Critique | `loyaltyAwardedAt` vérifié/verrouillé dans transaction |
| Dégradation checkout invité | Élevé | API guest existante conservée, test anonyme dédié |
| Effet de bord du cron | Élevé | secret, route idempotente, dry-run admin en dev/test |
| Périmètre trop large | Moyen | étapes atomiques, tests à chaque étape, opportunités non incluses |

## 6. Compatibilité, migration et données

Migration 0008 : colonnes de remboursement (`refund_amount`, `refund_status`, `refunded_at`), fidélité (`loyalty_awarded_at`, `cashback_amount`) et alertes (`last_notified_at`, `last_notified_price`). Elles ont des défauts/NULL compatibles avec les bookings et alertes existants.

Les entrées booking historiques ne sont pas retraitées automatiquement. Les comptes/factures continueront à les lire ; le nouveau calcul ne suppose pas que les marqueurs historiques existent.

## 7. Plan de développement validable

1. Écrire règles pures + tests.
2. Intégrer stock/capacité/prix dans `POST /api/bookings` et vérifier DB réelle.
3. Restreindre transitions/avis, intégrer fidélité idempotente.
4. Ajouter migration/remboursement/provider et états UI paiement.
5. Réparer URL checkout, invité, post-login, mobile.
6. Brancher conversations, pièces jointes, wishlist public, alertes cron.
7. Corriger dashboards/communication produit.
8. Exécuter migration, qualité, build, tests DB/HTTP puis analyse post-correction.

## 8. Retour arrière

- Revert du commit applicatif restaure la logique précédente ; les nouvelles colonnes restent inertes et n’empêchent pas l’ancienne version de fonctionner.
- Désactiver le cron en retirant la planification sans toucher aux alertes.
- Stripe Elements ne s’active que si la clé publique existe ; supprimer l’environnement revient au mock dev explicite.
- Les URLs legacy restent supportées pendant la période de transition.
