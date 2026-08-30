# Analyse de conception — T-153 (findings A→G, audit n°25)

- **Date** : 2026-08-30
- **Tâche** : T-153 — implémentation sans régression des remarques de
  l'audit fonctionnel n°25 (rapport `audit_fonctionnel_profond25_2026-08-30.md`).
- **Niveau** : S — Structurant (voir `analyse_impact_T-153_2026-08-30.md`).

## 1. Objectif

Corriger les 7 remarques **sans casser l'existant** : les cas EUR (cas réel
du seed) doivent produire **exactement les mêmes montants, statuts et rendus**
qu'avant. Les seuls changements visibles concernent les chambres non-EUR.

## 2. Problèmes actuels (constatés dans le code — faits, pas mémoire)

1. **Wallet** (`POST /api/bookings` l.~271) : `walletUsed = Math.min(wallet, total)`
   puis `total -= walletUsed` — mélange EUR/USD 1:1 ; `walletCreditsUsed`
   stocke le montant **devise chambre** alors qu'il est restitué tel quel au
   wallet EUR (`booking-benefits.ts` l.~20-27) ;
2. **Promo** (`lib/promotions.ts`) : `value/minBookingAmount/maxDiscount`
   appliqués tels quels au total de la chambre (aucune devise) ;
3. **Cashback** (`cron/price-alerts` l.~56 + `lib/loyalty.ts`) : 5 % du
   `booking.total` **devise chambre** crédité au wallet EUR ;
4. **UI** : 4 `€{...}` durs (E) ; lien `/recherche` sans fléchage (F) ;
   aucun état « avis bientôt » (G).

## 3. Décisions de conception

### 3.1 Convention de devises (sans migration)

- **`users.wallet_balance` = EUR** (déjà le cas : crédits BestRewards en €,
  affichage `€` sur la page wallet). Rien ne change.
- **`promotions.value/minBookingAmount/maxDiscount` = EUR** (libellés admin
  en €). Rien ne change en base.
- **`bookings.currency` = devise de la chambre** (déjà le cas).
- La conversion passe par `convertAmount(amount, from, to)` et
  `RATES_FROM_EUR` (taux figés, déjà utilisés partout pour l'affichage).

### 3.2 Nouveaux helpers purs (testables sans DB)

**`src/lib/wallet-currency.ts`** (nouveau) :

```ts
export interface WalletApplication {
  walletUsed: number;      // déduction dans la devise de la chambre
  walletUsedEur: number;   // débit réel du wallet (EUR) — ce qui est stocké/restitué
  totalAfter: number;      // total restant (devise chambre)
}
export function applyWalletToTotal(
  walletEur: number,
  total: number,
  currency: string,
): WalletApplication | { error: string }
```

- `currency` inconnue/absente → `{ error: "Devise non supportée" }`
  (aucun débit 1:1 : la garde est explicite) ;
- `walletInCurrency = convertAmount(walletEur, "EUR", currency)` ;
- `walletUsed = Math.min(walletInCurrency, total)` ;
- `walletUsedEur = convertAmount(walletUsed, currency, "EUR")` ;
- EUR → identité exacte (×1) : non-régression numerique.

**`src/lib/promotions.ts`** (extension, `applyPromoToTotal` inchangé) :

```ts
export function normalizePromoForCurrency(
  promo: PromotionLike,
  currency: string,
): PromotionLike;
```

- retourne une copie dont `value` (si `fixed_amount`), `minBookingAmount`,
  `maxDiscount` sont convertis EUR→currency ; `percentage` inchangé ;
- `promo` sans devise connue → copie **inchangée** (fallback historique) ;
- objectif : `applyPromoToTotal(normalizePromoForCurrency(p, c), total)`
  renvoie un discount **dans la devise de la chambre**.

**`src/lib/loyalty.ts`** (extension) : `calculateLoyaltyAward(state, total,
thresholds, currency?)` — paramètre **optionnel** ajouté en **dernière
position** ; si `currency` ≠ EUR, `total` est d'abord converti en EUR pour le
calcul du cashback (le wallet étant EUR). Appels existants (sans le 4e
argument) → comportement strictement identique.

### 3.3 `POST /api/bookings` (A+B)

- avant `applyPromoToTotal` : `const promoForCurrency =
  normalizePromoForCurrency(promo, room.currency ?? "EUR")` ;
- wallet : `const walletApp = applyWalletToTotal(wallet, total,
  room.currency ?? "EUR")` ; si `{error}` → `BookingRuleError` (409, message
  clair) ; sinon `walletUsed=walletApp.walletUsed`,
  `walletUsedEur=walletApp.walletUsedEur`, `total=walletApp.totalAfter` ;
- `discount += walletUsed` (devise chambre) inchangé ;
- `walletCreditsUsed: walletUsedEur.toFixed(2)` (EUR — cohérent avec la
  restitution) ;
- débit wallet : `walletBalance - walletUsedEur` (EUR).

### 3.4 UI `/reservation` (A+B)

- `PromoCodeInput` reçoit `currency={roomCurrency}` ;
- ligne wallet : `formatPrice(min(convertAmount(walletBalance,"EUR",
  roomCurrency), total), roomCurrency)` + mention « converti au taux
  indicatif » ;
- ligne total : `total - walletUsedInRoomCurrency` ;
- `GET /api/promotions/apply` accepte `currency` (défaut `EUR`) et renvoie
  `currency` (champ additif) → `PromoCodeInput` affiche
  `formatPrice(discount, currency)`.

### 3.5 Cron cashback (C)

`cron/price-alerts` : `calculateLoyaltyAward(state,
Number(booking.total), thresholds, booking.currency ?? "EUR")` →
`cashbackAmount` = montant EUR crédité (les analytics restent par devise).

### 3.6 `€` durs (E)

- `dashboard/properties/[id]` : `Room.currency?` + `formatPrice(basePrice,
  currency ?? "EUR")` ;
- `mon-compte` : `formatPrice(user.walletBalance ?? "0", "EUR")` ;
- `bestrewards-status` : `formatPrice(Number(wallet), "EUR")` ;
- `promo-code-input` : `formatPrice(applied.discount, applied.currency)`
  (l'API renvoie la devise demandée ; fallback `cur ?? "EUR"`).

### 3.7 Fléchage wallet (F)

- `mon-compte` : `href="/recherche?wallet=1"` ;
- `recherche/page.tsx` : `searchParams.wallet === "1"` → bandeau
  « 💰 {t("search.walletBanner")} » (localisé FR/EN, nouvelle clé).

### 3.8 État avis (G)

- `mes-reservations` (section Passées) : si `status === "confirmed"` et
  `checkOut < today` → badge gris « {t("bookings.reviewSoon")} »
  (« Avis bientôt disponible ») — aucune action proposée, aucun changement
  d'API.

### 3.9 `notFound()` → 200 (D)

- **Aucune modification de code de routage** : le statut 200 est une limite
  du streaming App Router (layout `(main)` async) ; le `not-found.tsx`
  global émet déjà `<meta name="robots" content="noindex">` (vérifié dans le
  HTML rendu) → le contenu 404 n'est **pas indexé**.
- **Documentation** dans `KNOWN_LIMITATIONS.md` (limite assumée, corrigée
  partiellement par le noindex). Pas de régression possible (aucun
  comportement modifié).

## 4. Non-régression — assertions

| Cas | Avant | Après |
|---|---|---|
| Booking EUR + wallet EUR | débit EUR | **identique** (conversion ×1) |
| Booking EUR + promo fixe 20 | remise 20 | **identique** |
| `calculateLoyaltyAward` 3 args | inchangé | **identique** (4e arg optionnel) |
| `GET /api/promotions/apply` sans currency | discount EUR | **identique** + champ `currency:"EUR"` additif |
| Affichage EUR (mon-compte, dashboard) | `€25.00` | `25,00 €` (format harmonisé, même valeur) |
| Page 404 dynamique | 200 + noindex | **identique** (documenté) |

## 5. Plan de tests

- unitaires : `wallet-currency.test.ts` (EUR identité, USD conversion,
  devise inconnue) ; `promotions.test.ts` +normalize (EUR identité, USD
  fixed/min/max, percentage inchangé) ; `loyalty.test.ts` +currency (USD
  cashback converti, EUR identique) ;
- intégration : `bookings/route.test.ts` +1 (booking USD avec wallet 25 € →
  `walletCreditsUsed` en EUR, total en USD, débit wallet EUR) ;
- smoke inchangé (doit rester 94/94) ;
- preuves runtime HTTP (booking USD réel, cron cashback, UI EUR).
