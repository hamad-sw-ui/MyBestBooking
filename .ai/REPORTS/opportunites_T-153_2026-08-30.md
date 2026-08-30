# Opportunités identifiées pendant l'audit n°25 — T-153

- **Date** : 2026-08-30
- **Contexte** : en analysant les findings A→G de
  `audit_fonctionnel_profond25_2026-08-30.md`, des améliorations plus larges
  ont été identifiées. Proposées **hors périmètre T-153** (aucune
  modification ici) — à arbitrer.

## 1. Devise sur le wallet (migration réelle)

Le wallet est implicite EUR. Pour un vrai multi-devises, ajouter
`users.wallet_currency` (ou une table `wallet_ledger` avec devise par
mouvement). Bénéfice : cashback/parrainage libellés explicitement.
Coût : migration + toute la chaîne de restitution. → **backlog produit**.

## 2. Colonne `promotions.currency`

`promotions.value` resterait en EUR mais une nouvelle colonne
`currency DEFAULT 'EUR'` permettrait des promos natives USD/GBP (formulaire
admin + validation). Bénéfice : suppression de la convention « montants en
EUR ». Coût : migration + form + tests. → **backlog produit**.

## 3. Taux de change dynamique

`RATES_FROM_EUR` est figé V1. Pour un vrai marketplace, brancher un service
FX (avec cache) + affichage « taux du jour ». À cadrer avec la politique
comptable (gel du taux à la réservation ? au paiement ?).
→ **backlog produit, hors sandbox**.

## 4. Statut HTTP des 404 dynamiques (Next.js)

La limite streaming (200 sur `notFound()` de pages dynamiques) pourrait être
levée en refactorant les pages concernées vers des **route handlers** + RSC
manuels, ou en passant à un rendu non-streamé sur ces routes (perte de
perf). À réévaluer si les moteurs de recherche deviennent un canal
acquis. → **backlog technique**.

## 5. Multi-devises côté dashboard (prix/nuit, calendrier)

Les pages `dashboard/rooms/*` peuvent afficher des prix multi-devises ; la
migration `formatPrice(…, room.currency)` est à étendre au calendrier et aux
grilles tarifaires. → sous-tâche rapide à planifier.

## 6. Tests E2E Playwright

Le CDN Chromium étant indisponible dans le sandbox, les E2E restent CI-only.
Une fois la CI activée, ajouter un test de bout en bout « réservation USD
avec wallet + promo » couvrirait les findings A/B/C de façon reproductible.
→ **CI backlog**.
