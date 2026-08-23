# 🎯 TÂCHE EN COURS

**Tâche :** Remédier aux séquences critiques révélées par l’audit extrême.
**ID** : T-106
**Niveau** : **C** — paiement pending, webhook inbox, outbox lease, uploads et migrations.
**Statut** : **CORRIGÉ (VALIDÉ)**

## Livré

- expiration pending, restauration promo/wallet, inbox webhook idempotente ;
- outbox lease/retry, notifications message/alertes dans outbox ;
- upload transactionnel, suppression pending contrôlée ;
- quote annulation, remboursement visible, textes avis/support/perks cohérents ;
- alert context API, recherche et diagnostics provider durcis.

## Preuves

- 🔨 typecheck/build/lint ;
- 🧪 215/215 DB+serveur ;
- ▶️ migration 0012, expiration, inbox précoce, CSV, smoke 91/91 ;
- 🔨 ai:check 18 OK, 0 fail.
