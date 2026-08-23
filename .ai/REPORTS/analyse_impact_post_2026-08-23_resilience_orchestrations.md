# Analyse d’impact post-correction — T-107

## Correctifs effectivement livrés

| Écart d’audit | Correction | Effet vérifié |
|---|---|---|
| PSP sous transaction booking | `POST /api/bookings` ne crée plus l’intent dans le verrou room/user. `payment-intents.ts` l’attache après commit, avec TTL et reprise cron. | booking mock HTTP `201` confirmé avec intent rattaché ; build compile la route. |
| succès après expiration | `payment-events.ts` laisse le séjour `cancelled`, passe le paiement capturé à `paid` et demande un refund idempotent ; cron réconcilie les `pending`. | webhook mock tardif : `cancelled`, `paid`, `refunded`, `refundProviderId` présent ; retry inbox sans résurrection. |
| promo/wallet retenus | marque `benefitsReleasedAt` + libération transactionnelle unique pour échec webook/annulation pending/expiration. | migration 0013 et contrôle de code ; expiration existante conserve restauration atomique. |
| email post-acceptation ambigu | `eventKey` est transmis au mailer ; Resend reçoit `Idempotency-Key`, ConsoleMailer écrit un id déterministe ; `providerMessageId` est persisté. | lease expiré repris : tentative 2, même id, 2 fichiers avant/après. |
| avis voté non supprimable | suppression explicite transactionnelle des votes + FK cascade migration 0013. | bulk admin réel : review et vote tous deux à zéro. |
| alerte séjour trompeuse | quote serveur par chambre appliquant les règles booking, sans contexte fallback honnête "prix de base". | alerte 10–12 décembre, 1 adulte : `last_notified_price=198.00` avec overrides 99×2. |
| pagination/écrans partiels | count SQL, ordre stable, page bornée ; pagination calendrier 90 jours ; éditeur rate plan complet et aperçu. | `/recherche?page=999` retourne page 1/1 non vide ; PATCH rate plan réel 200 avec champs modifiés. |
| rotation impossible | keyring primaire/précédent, endpoint admin confirmé, audit sans secret et UI conditionnelle. | Vitest DB : ancienne clé lue, 1 valeur réchiffrée, lecture réussie après retrait de clé précédente. |

## Non-régressions confirmées

- migrations précédentes et données historisées conservées ; `0013` est additive à l’exception contrôlée des FK votes désormais cascade ;
- contrat checkout, URL legacy, mock paiement, cron, UI rate plan et fallback env provider préservés ;
- zéro secret ajouté à source, réponse HTTP, métadonnée admin ou audit ;
- appels PSP/mail externes restent hors transaction DB ;
- les claims de provider réel ne dépassent pas les tests mock/unitaires : aucune clé Stripe/Resend/S3 de test n’était configurée.

## Limites maintenues consciemment

1. Un crash réseau extrêmement ambigu après `create` peut nécessiter la reprise cron avant que l’intent Stripe soit utilisable par le voyageur ; le hold expire en quinze minutes et n’est jamais facturé/confirmé à tort. Un endpoint de reprise Stripe Elements/queue dédiée est une évolution de produit ultérieure.
2. L’exactly-once email final dépend du support de `Idempotency-Key` fournisseur : Resend est couvert; ConsoleMailer simule cette propriété. Une preuve avec un compte Resend reste à obtenir.
3. Les alertes ne convertissent pas les devises et n’intègrent pas promo/wallet/rate plan personnel ; elles annoncent donc le total de nuits public hors taxes/réductions personnelles.
4. Support ticketé, facture légale/payout, réimport automatisé de pièces jointes historiques et E2E Chromium restent hors périmètre T-107, consignés dans les limites/backlog existants.
