# 🎯 TÂCHE EN COURS

**Tâche :** Rendre le checkout invité revendicable, le paiement reprenable et
les effets opérationnels cohérents après l’audit post T-107.
**ID** : T-109
**Niveau** : **C** — identité invitée, paiement, webhook, notifications et messages.
**Statut** : **CORRIGÉ (VALIDÉ)**

## Périmètre

- claim token invité après validation booking ;
- endpoint/UI de reprise payment propriétaire ;
- outbox pour claim/reset et livraison rapide des messages ;
- webhook Stripe multi-signatures/allowlist ;
- messages dashboard, rate-limit/MIME et alertes reset contexte.

## Livré et validé

- claim invité hashé et session post-password, sans profil sur demande invalide ;
- endpoint/reprise UI du même paiement, retrieve provider idempotent ;
- webhooks allowlistés/multi-signatures, outbox auth/messages et alert reset ;
- dashboard messages navigable, rate-limit/MIME fiabilisés.

## Preuves

- migration fraîche; typecheck/build/lint 0 erreur ;
- 223/223 tests, smoke 91/91 ;
- ▶️ guest/claim, alert/outbox et API runtime validés.

T-110 reste requis pour settings décoratifs, multi-devise/timezone, quote UI et
bornes de dates. Aucun provider réel sans credentials test.
