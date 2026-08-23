# Analyse d’impact — T-109 : claim invité, reprise paiement et effets opérationnels

- **Niveau** : C
- **Statut** : en cours
- **Origine** : BUG-037/038, AUD-108-08/09/10/14/19/21/22.

## Objectif

Rendre le checkout invité revendicable sans créer de compte avant validation,
rendre un intent payment reprenable par son propriétaire, homogénéiser les
notifications critiques dans l’outbox, durcir webhooks Stripe et messages, et
empêcher qu’une alerte remplacée soit dédupliquée par un ancien contexte.

## Invariants

- aucun token invité en clair en DB; token à usage unique, hashé, TTL court ;
- pas de session automatique non expliquée pour un invité; claim email crée la
  session après choix password ;
- aucun intent/retry PSP sous transaction DB, mêmes clés idempotentes ;
- emails reset/claim/annulation/messages gardent les templates et fallback mailer ;
- anciennes réservations, liens reset et alertes continuent de fonctionner ;
- webhook réel non déclaré validé sans Stripe test credentials.

## Risques et protections

| Risque | Protection |
|---|---|
| compte invité orphelin | insertion user seulement après règles booking, claim token email |
| double claim | `verification_tokens` hash + `usedAt` transactionnel |
| lien claim intercepté | TTL, HTTPS production, mot de passe requis, session créée après consume |
| double payment | endpoint propriétaire réutilise intent/key, jamais montant navigateur |
| message spam | rate-limit auteur/conversation, MIME depuis upload DB |
| webhook invalide | toutes signatures v1, allowlist stricte |
| alerte obsolète | reset `lastNotified*` lorsque le contexte change |

## Validation requise

- guest invalid → aucun user; guest valid → token claim/outbox; claim → password/session/bookings;
- endpoint resume owner retourne même intent ou relance seulement hold valide;
- multi-signature Stripe, type inconnu, event payment/refund tests;
- message host link + rate limit/MIME;
- update alerte contexte reset;
- migration fraîche, typecheck/lint/tests/build/smoke/ai check.
