# Audit fonctionnel profond n°9 — MyBestBooking

- **Date** : 2026-08-28 · **Branche** : `arena/01a042cf-mybestbooking` (HEAD T-128 `5bf67c7`)
- **Méthode** : exécution réelle (dev, sessions customer/host/admin + anonyme), au-delà du HTTP 200 ; code relu. Aucun code de production modifié ; données de test nettoyées.
- **Périmètre neuf** : création/édition de chambres (cohérence capacité/prix), application réelle d'un **plan tarifaire** au prix de réservation, **restitution du wallet/usage promo à l'annulation** d'une réservation payée, pagination, page `/reservation`, préférences de notification.

## Synthèse

Le calcul de prix et des remises (plan tarifaire, BestRewards, promo, wallet) est correct ; la logique de réservation/capacité/stop-sell est saine. **1 écart financier réel** (perte des crédits wallet à l'annulation d'une réservation payée) et **2 manques de validation côté hôte** (données incohérentes possibles, mais neutralisées par les garde-fous de réservation).

| Ref | Sévérité | Sujet |
|-----|----------|-------|
| **P1** | 🔴 Moyenne-élevée | Annulation d'une réservation **payée** : les **crédits wallet utilisés** ne sont **pas restitués** au client, et l'usage d'un **code promo n'est pas rendu** (`releaseBookingBenefits` n'est appelée que pour les réservations non payées). Le remboursement porte sur la part payée (carte/PSP) mais oublie la part wallet. |
| **P2** | 🟡 Basse | Création de chambre (`POST /api/rooms`) accepte des capacités **incohérentes** (`maxAdults > maxOccupancy`, `maxAdults+maxChildren > maxOccupancy`) → stockées telles quelles. Le garde-fou de réservation bloque de toute façon à la réservation (409), donc pas de réservation abusive, mais la fiche chambre porte des données contradictoires. |
| **P3** | 🟡 Basse | Création de chambre accepte `basePrice: 0` (et un quantité sans plafond haute) ; cohérent de borner/min sur le prix comme pour les autres entités. |

---

## P1 — Wallet non restitué à l'annulation d'une réservation payée

### Preuve d'exécution (client démo, wallet = 25 €)

1. Réservation 2 nuits avec `useWalletCredits:true` → résa `payée` (`mock_card`), `wallet_credits_used = 25.00`, `total = 191.69`, `wallet client passe de 25.00 → 0.00`.
2. Devis d'annulation à 89 jours du check-in : `cancellationFee = 0.00`, `estimatedRefund = 191.69` (la part carte).
3. Annulation (PUT status=cancelled) →
   `status = cancelled`, `payment_status = paid`, **`refund_status = refunded`**, **`benefits_released_at = null`**, **`wallet_credits_used = 25.00`**.
4. Wallet client après annulation : **`0.00`** (les 25 € ne reviennent jamais).

### Cause

`src/lib/booking-cancellation.ts:63` :

```ts
if (prepared.paymentStatus === "paid" && refundAmount > 0) {
  await refundLateCapturedPayment(prepared.id);      // rembourse la part carte (PSP)
} else if (prepared.paymentStatus === "pending" && prepared.paymentIntentId) {
  await getPaymentProvider().cancel(...);
}
if (prepared.paymentStatus !== "paid") await releaseBookingBenefits(prepared.id); // ← exclut les payées
```

`releaseBookingBenefits` (`src/lib/booking-benefits.ts:20-29`) restitue le wallet et rend l'usage promo :

```ts
const walletUsed = Number(booking.walletCreditsUsed ?? "0");
if (walletUsed > 0) { … walletBalance = walletBalance + walletUsed … }
if (booking.promotionId) { … promotions.currentUses = GREATEST(currentUses-1,0) … }
```

Mais elle est appelée **seulement pour les réservations non payées** (`!== "paid"`) — c'est-à-dire l'expiration/échec de paiement. Pour une réservation payée puis annulée :
- le PSP (`mock_card`/Stripe) est remboursé via `refundLateCapturedPayment` (idempotent, garde `refundStatus==="refunded"` + `paymentIntentId`),
- la **part wallet**, elle, n'est remboursée par aucun acteur (le PSP ne connaît pas les crédits internes), et `releaseBookingBenefits` n'est jamais appelée.

Le webhook (`src/lib/payment-events.ts`) ne restitue les bénéfices que sur `payment failed` (réservation `pending`), jamais sur une réservation `cancelled + paid`. Le chemin « tout payé en wallet » (`total ≤ 0` → `paymentMethod:"wallet"`, `paymentStatus:"paid"`) est également touché : annuler une résa à 0 € payée en crédits ne restitue rien.

### Impact

- Perte d'argent pour le voyageur : ses crédits utilisés (portefeuille/filleul/cashback) disparaissent à l'annulation, alors que la politique affiche un remboursement intégral (frais 0).
- Sur-comptage des usages de code promo (un client qui annule rend la promo « utilisée » alors que la réservation est annulée).
- Pas de double-dépense ni de faille de sécurité : la réservation est bien annulée, l'inventaire libéré et la part carte remboursée ; c'est un **manque de restitution** sur la partie crédits.

### Solution sans régression

Rendre la restitution des bénéfices **systématique** à l'annulation, et s'appuyer sur son **idempotence** déjà en place (`benefitsReleasedAt`, transaction `FOR UPDATE`) :

```ts
// booking-cancellation.ts — après le traitement PSP
if (prepared.paymentStatus === "paid" && refundAmount > 0) {
  await refundLateCapturedPayment(prepared.id);
} else if (prepared.paymentStatus === "pending" && prepared.paymentIntentId) {
  try { await (await getPaymentProvider()).cancel(prepared.paymentIntentId); } catch (e) { … }
}
// T-129 : les crédits wallet et l'usage promo n'ont pas d'équivalent PSP : on les
// restitue dans tous les cas d'annulation (payée ou non). Idempotent via
// benefitsReleasedAt. La part carte reste gérée par refundLateCapturedPayment
// (garde refundStatus), sans double remboursement.
await releaseBookingBenefits(prepared.id);
```

- **Pas de double remboursement carte** : `releaseBookingBenefits` ne touche pas au PSP ; il ne fait que `walletBalance += walletCreditsUsed` et décrémente `promotions.currentUses`.
- **Idempotence** : `releaseBookingBenefits` n'agit que si `status==="cancelled" && !benefitsReleasedAt` et pose `benefitsReleasedAt` ; appels répétés (cron/webhook/réessai) sans effet de bord.
- **Cohérence expiration** : l'expiration (impayée) continue de restituer — inchangée.
- Le `currentUses` promo n'est rendu qu'une fois (même garde) et ne descend jamais sous 0 (`GREATEST(...,0)`).

**À tester** : annulation d'une résa payée avec wallet → wallet réaugmenté du montant utilisé ; annulation d'une résa impayée (expiration) → comportement inchangé ; double annulation/réessai → pas de double restitution ; promo rendue une seule fois.

---

## P2 — Capacités incohérentes acceptées à la création de chambre

**Preuve** : `POST /api/rooms {maxOccupancy:1, maxAdults:4, basePrice:100}` → **201** (chambre créée avec ces valeurs). Idem `maxChildren` non borné par `maxOccupancy`.

Le schéma Zod valide `maxOccupancy ≥ 1` et `maxAdults ≥ 1` indépendamment, sans vérifier les relations entre eux.

**Garde-fou existant (à conserver)** : `evaluateBookingRules`/`capacityError` (`src/lib/booking-rules.ts`) rejette à la réservation toute combinaison dépassant la capacité — prouvé à l'exécution (réserver 2 adultes dans la chambre incohérente → **409** « Cette chambre accepte au maximum 1 personne »). Aucune réservation abusive possible.

**Solution (additif, à la création et à l'édition)** : ajouter un `.refine()` (et la garde miroir côté formulaire) :
- `maxAdults ≤ maxOccupancy` ;
- `(maxAdults + (maxChildren ?? 0)) ≤ maxOccupancy` ;
- message clair « La capacité totale doit être cohérente (adultes + enfants ≤ capacité maximale) ».
Les chambres existantes ne sont pas modifiées (validation à l'écriture seulement).

## P3 — `basePrice: 0` et quantité sans plafond acceptés à la création de chambre

**Preuve** : `POST /api/rooms {basePrice:0, …}` → **201**. `basePrice` est borné `min(0)` ; `quantity` `min(1)` sans max.

**Impact** : une chambre à 0 € produit des réservations à 0 € (et donc un parcours « tout wallet »), ce qui est probablement non souhaité en saisie (même si une promo réelle peut créer un total 0). Aucune faille de sécurité (la réservation reste comptabilisée).

**Solution (additif, léger)** : exiger `basePrice > 0` (`.positive()` sur le montant de la chambre, en cohérence avec les autres tarifs) ou, pour autoriser explicitement un tarif « sur demande », borner et documenter ; borner `quantity` à une valeur réaliste (`max(99)`). À confirmer produit ; si un hébergement gratuit est un cas réel, conserver `0` mais le faire apparaître comme « gratuit » dans l'UI plutôt que comme tarif par défaut.

---

## Zones vérifiées SAINES (à ne pas régresser)

- **Plan tarifaire réel** : un rate-plan à 20 % diminue bien le sous-total (237,34 → 189,87, soit −20 % sur le sous-total avant taxes) ; le nom du plan est snapshoté ; un plan invalide (`discountPercentage>100`, politique hors enum) est rejeté 400 (audit 6). BestRewards s'applique ensuite, puis wallet — ordre préservé.
- **Réservation / capacité / stop-sell** : capacité dépassée → 409 « …maximum X adultes/personnes » ; chambre d'une autre propriété → 400 ; stop-sell posé sur les nuits → 409 ; verrous `FOR UPDATE`.
- **Contrôle d'accès création chambre** : customer → 401 ; propriété inexistante → 404 ; propriété d'un autre hôte → 403.
- **Annulation (partie saine)** : devis avec frais/politique (`cancellationFee`, `estimatedRefund`, `daysBeforeCheckIn`) ; annulation → remboursement PSP idempotent (`refundStatus refunded`, garde `paymentIntentId`/`refundStatus`) ; inventaire/stock libérés ; double annulation gérée.
- **Pagination** : `offset` négatif/non numérique → 400 ; `limit` invalide/négatif retombe sur 20 et est plafonné à 100 (T-121, défensif) ; `reviews` borne `limit` 1..100 via Zod.
- **Page `/reservation`** : client component qui lit les params et charge via l'API (qui valide) ; rend 200 même sans/avec mauvais `propertyId` (l'erreur est affichée côté client) — pas de risque serveur.
- **Préférences notification** : le composant documente honnêtement la limite V1 (seul `priceAlertEnabled` est par utilisateur ; les autres flags sont globaux) ; pas de fausse fonctionnalité.
- **Maintenance (T-128)** : la route `/api/maintenance-status` et la garde cliente sont en place ; vérifiées au repos pendant l'audit.

## Aucune donnée de test résiduelle

- Chambres de test (« Chambre Incohérente », « Chambre Gratuite », « Chambre Audit9 ») supprimées.
- Réservations de test (`MBB-2026-QMFM10`, `MBB-2026-B6R7LV`, `MBB-2026-48ENYG`) supprimées ; rate-plan « Audit9 -20% » supprimé.
- Wallet du client démo restauré à **25,00 €**.
