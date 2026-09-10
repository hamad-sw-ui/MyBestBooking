# Analyse de conception — T-209 — Implémentation des remarques T-208

## 1. Objectif

Corriger les sept findings de l'audit T-208 sans régression, en maintenant la décision T-207 : MyBestBooking collecte des demandes de réservation et ne propose plus de paiement plateforme au voyageur.

## 2. Problème actuel

- Les demandes `pending` no-payment ont `paymentExpiresAt:null` et sont comptées comme indisponibles tant qu'elles ne sont pas annulées : stock bloqué indéfiniment.
- Le voyageur et l'hôte ne reçoivent pas immédiatement d'email « demande reçue » distinct de la confirmation.
- Les comptes démo, dont l'admin, sont visibles sur `/connexion` en toute configuration.
- Le bouton de seed de l'accueil vide est une action de démo exposée sans flag UI.
- Le dashboard billing masque les actions de payout depuis T-207, mais les routes POST/cron payout legacy restent actionnables.
- `dashboards_sim.py` garde des hypothèses obsolètes (hard-delete rooms, libellé exact de skip).
- Deux composants client avec fetch restent volontairement silencieux sans feedback/observabilité.

## 3. Solutions possibles

### Solution A — Ne plus compter les demandes `pending` dans la disponibilité

- **Avantages** : pas de migration, stock jamais bloqué.
- **Inconvénients** : risque de surbooking de demandes si plusieurs voyageurs réservent la même chambre avant validation hôte.
- **Sécurité/intégrité** : faible pour le stock ; demande à résoudre des conflits plus tard.
- **Maintenabilité** : simple mais change la sémantique métier.

### Solution B — TTL dédié `requestExpiresAt` sur demandes manuelles

- **Avantages** : conserve le hold conservateur, libère automatiquement, distingue clairement paiement vs demande.
- **Inconvénients** : migration DB + tests cron ; nécessite une durée par défaut.
- **Sécurité/intégrité** : bonne, car le verrou stock reste jusqu'à expiration ou annulation explicite.
- **Maintenabilité** : claire ; champ nullable compatible historique.

### Solution C — Table séparée de holds de demande

- **Avantages** : séparation stricte des concepts, auditabilité fine.
- **Inconvénients** : plus lourde, migrations et transactions supplémentaires, risque de divergence booking/hold.
- **Sécurité/intégrité** : bonne si synchronisée, mais complexité plus élevée.
- **Maintenabilité** : surdimensionnée pour la correction T-208.

## 4. Solution retenue

Retenir **B** : colonne nullable `bookings.request_expires_at`, initialisée sur les nouvelles demandes manuelles `pending`, vidée lorsque la réservation sort de `pending` (confirmation/annulation) et consommée par un cron d'expiration. Durée par défaut : 24 h, configurable par env serveur `BOOKING_REQUEST_TTL_HOURS` bornée.

Autres décisions :

- Emails de demande créée via outbox idempotente avec deux eventKeys (`booking.request.traveler:{id}` et `booking.request.host:{id}`), templates séparés.
- Flags démo centralisés : UI `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`, `NEXT_PUBLIC_ENABLE_DEMO_SEED`; API login démo `DEMO_LOGIN_ENABLED` ou opt-in public explicite en sandbox.
- Payout legacy : helper serveur `platformPayoutsEnabled()` faux par défaut ; GET historique conservé ; POST payout, POST account et cron payout retournent `410` quand le flag est off.
- QA dashboards : suivre le contrat soft-delete (`rooms.isActive=false`) et vérifier des raisons de skip structurées plutôt que des mots exacts.
- Feedback fetch : états `loading|ready|error`, `console.warn` sans PII et live-region sr-only uniquement en cas d'échec.

## 5. Risques

| Risque | Niveau | Mitigation |
|---|---|---|
| Expirer une demande que l'hôte voulait accepter | Moyen | TTL 24 h, seulement `status='pending'`, `paymentIntentId IS NULL`, `paymentStatus='pending'`, `requestExpiresAt <= now` ; la confirmation vide le TTL. |
| Casser les anciens bookings sans champ TTL | Faible | Colonne nullable ; historiques sans TTL restent inchangés sauf s'ils sont créés après migration. |
| Emails en doublon | Moyen | Event keys outbox distinctes et idempotentes ; livraison best-effort après commit. |
| Démo invisible dans le sandbox de validation | Moyen | `scripts/restore-env.sh` active explicitement les flags démo de preview ; prod réelle reste opt-in. |
| Tests payout historiques cassés | Moyen | Tests legacy posent `PLATFORM_PAYOUTS_ENABLED=true`; nouveaux tests couvrent le mode off par défaut. |
| Bruit UX des fetchs silencieux | Faible | Feedback sr-only seulement sur erreur ; navigation reste fail-open. |

## 6. Compatibilité

- Migration additive nullable, pas de rewrite de données.
- Contrat `POST /api/bookings` enrichi par `requestExpiresAt` ; champs existants conservés.
- `paymentExpiresAt` reste réservé aux anciens holds paiement avec `paymentIntentId`.
- Les confirmations manuelles et constats de paiement hors plateforme existants restent inchangés.
- La lecture des payouts/exports historiques reste disponible.

## 7. Plan de développement

1. Ajouter helpers flags (`demo`, `payout`, `booking request TTL`) et tests purs.
2. Ajouter migration `0020` + champ `requestExpiresAt` dans `schema.ts`.
3. Modifier `POST /api/bookings`, `PUT /api/bookings/[id]` et cron expiration.
4. Ajouter templates/email outbox « demande créée » et tests.
5. Gater UI/API démo et seed UI.
6. Gater routes payout mutables et adapter tests legacy.
7. Mettre à jour QA dashboards et feedback fetchs.
8. Mettre à jour `.ai/` (DATABASE/API/FEATURES/TRACEABILITY/PROGRESS/STATE) puis validations.

## 8. Plan de retour arrière

- Revert du diff T-209 et suppression de la migration non appliquée si non déployée.
- Si la migration a été appliquée, rollback logique : laisser la colonne nullable inutilisée et retirer son écriture/expiration dans un patch ultérieur ; aucune donnée existante n'est rendue invalide.
- Flags démo/payout : restauration possible par env sans migration.

## Décision

Implémenter la solution retenue en maintenant les gardes serveur comme source de vérité ; aucune solution purement UI ne suffit pour les éléments sécurité/payout.
