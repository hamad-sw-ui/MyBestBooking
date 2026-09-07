# Débat technique — Versements hôtes/admins (Phases C)

- **Date** : 2026-09-06
- **Tâche** : T-195 · Phase C — versement du `netToHost` au compte bancaire de l'hôte/admin
- **Niveau** : **C** — logique financière + schéma + données bancaires
- **Proposition initiale** : ajouter un ledger `payouts` + `payout_accounts` (additif), un moteur
  d'agrégation pur converti par `PayoutProvider` (mock en dev, Stripe Connect si clés), une UI
  « Versements » dans le billing, sans toucher au flux de paiement client.

> ⚠️ Aucune objection n'est actée sans vérification dans le code (règle §15.2). Les commandes de
> vérification sont citées.

---

## Rôle 1 — Architecte

La solution est **additive** : une table `payouts` + `payout_accounts`, un module `payouts.ts` et un
`PayoutProvider`. Cela ne crée pas de couplage transverse nouveau (on réutilise
`provider-credentials.ts` et le pattern `payment/index.ts`). **Avis favorable** à condition de ne pas
lier le ledger au PaymentIntent client (séparation des responsabilités : encaissement ≠ versement).

## Rôle 2 — Développeur Next.js senior

Idiomatique : les pages RSC lisent l'agrégat, l'UI « Versements » est un client component, la route
API `POST /api/host/payouts` reçoit la demande. ⚠️ **Objection** : ne pas créer de Server Action pour
un acte financier ; privilégier un route handler avec revalidation. **Retenue.**

## Rôle 3 — Expert TypeScript

⚠️ **Objection** : les montants sont des `decimal`/`string` en DB. Le ledger doit utiliser des
`number` finis et des arrondis contrôlés, jamais de comparaison `==`. Types via `$inferSelect`. **Retenue.**

## Rôle 4 — Expert React (RSC/Client)

Frontière claire : RSC pour la lecture (liste + totaux), client component pour « Demander un versement ».
⚠️ **Objection** : ne jamais passer la clé chiffrée (IBAN) au client. **Retenue.**

## Rôle 5 — Expert Drizzle/SQL

Agrégation par curseur (`bookings.paymentStatus='paid'`, `status != 'cancelled'`, période) via le
driver, pas de boucle N+1. Index `payouts(host_id, status)` et `payout_accounts(user_id)`.

## Rôle 6 — Expert PostgreSQL

⚠️ **Objection** : le versement est **idempotent** — une seule ligne `(host_id, period_start,
period_end, currency)` avec `idempotency_key` unique en contrainte. Migration **additive** (pas de
modification de table existante), testée sur chaîne fraîche. **Retenue.**

## Rôle 7 — Expert sécurité web

⚠️ **Objection bloquante** : l'IBAN/account est une donnée sensible. Il doit être chiffré
AES-256-GCM (clé `CREDENTIALS_ENCRYPTION_KEY` du coffre), **jamais réaffiché**, jamais renvoyé en
JSON. Rate-limit + rôle `host`/`admin` vérifié sur la route. **Retenue** → implémenté.

## Rôle 8 — Ingénieur QA

Tests : agrégation pure (gross/commission/net par devise), idempotence (même `idempotency_key`),
rejet du transfert multi-devise, refus si pas de compte connecté (non-régression). Unitaires purs +
un test d'intégration ledger.

## Rôle 9 — DevOps/SRE

Le cron de versement suit le pattern `cron-runner` existant ; aucune env var nouvelle obligatoire.
Le `PayoutProvider` mock est confiné au dev (comme `MockPaymentProvider`). Logs d'audit via
`audit_log`.

## Rôle 10 — Expert UX/a11y

✋ RAS pour la partie versement (rollup sur demande) — libellés FR/EN, statuts
`pending`/`paid`/`failed`, focus visible.

## Rôle 11 — Relecteur (advocatus diaboli)

⚠️ **Objection bloquante** : sans Stripe Connect testé, la promesse « l'hôte reçoit sur son compte »
n'est **pas exécutable ici**. Il faut clarifier la portée : la **partie interne** (ledger, agrégation,
UI, mock) est validable ; la **partie externe** (transfert Connect réel) ne l'est pas sans clés.
**Action** : implémenter l'interne avec `PayoutProvider` mock (comportement complet en dev), scaffolder
le provider Stripe Connect qui lève une erreur explicite si clés absentes, et **documenter** que
l'exécution réelle reste `CORRIGÉ (INSPECTION)`.

---

## Synthèse

- **Retenus** : séparation encaissement/versement ; route handler (pas Server Action) ; idempotence
  via contrainte unique ; chiffrement de l'IBAN ; agrégation pure + provider mock ; non-régression
  sans compte connecté.
- **Écartés** : coupler le versement au PaymentIntent client (risque de régression) ; débit/transfert
  direct sans connect account (casserait le paiement actuel).
- **Risque résiduel accepté** : l'exécution Stripe Connect réelle nécessite des clés de test absentes
  du sandbox → marquée `CORRIGÉ (INSPECTION)` dans le rapport, la partie interne visant `VALIDÉ`.

## Décision finale

On implémente la **fondation non-régressive** : modèle `payouts`/`payout_accounts` (additif),
`src/lib/payouts.ts` (agrégation + idempotence), `PayoutProvider` (mock/stripe), UI « Versements »
et route API. Le paiement client reste **inchangé**. Le branchement Stripe Connect réel est
documenté comme hors validation sandbox.
