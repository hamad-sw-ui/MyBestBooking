# Analyse d’impact — T-106 : remédiation audit extrême

- **Niveau** : C
- **Motif** : paiements pending/webhooks, outbox, uploads privés, annulation, avis, alertes et migrations.

## Surface impactée

- booking/payment/webhook/cron/outbox ;
- messages/upload objects/attachment handler ;
- reviews/votes ;
- price alerts/recherche/calendrier ;
- provider tests, help/support, billing ;
- schéma Drizzle et migrations.

## Risques / non-régression

| Risque | Protection |
|---|---|
| annuler un paiement valable | expiration uniquement bookings pending avant deadline |
| double webhook/refund/email | inbox idempotente + clés uniques |
| supprimer attachment utilisée | FK/messageId + delete 409 |
| modifier booking historique | uniquement nouvelles colonnes / snapshots |
| migration DB | tables/colonnes additives, test fresh migration |
| UX contradictoire | texte aligné sur état backend |

## Tests exigés

- booking pending expiré/promo restaurée ;
- webhook inbox reçu avant booking puis traité ;
- lease outbox sending expiré ;
- message+upload transaction ;
- delete attachment attachée refusé ;
- vote unique DB ;
- quote annulation ;
- pagination total ;
- migration fraîche/build/smoke/tests DB.
