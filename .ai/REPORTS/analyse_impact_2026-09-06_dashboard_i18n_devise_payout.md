# Analyse d'impact — Dashboard i18n + conversion devises + versement hôte/admin

- **Date** : 2026-09-06
- **Tâche** : implémentation des remarques issues de l'analyse
  `docs/analyse_2026-09-06_i18n_devises_payout.md`
- **Niveau** : **S** pour les Phases A/B, **C** pour la Phase C (logique financière + schéma).
  Par proportionnalité (§15.0), en cas de doute on retient le **plus élevé** → analyse complète.

## Préambule — référence verte établie (avant toute modification)

```
tsc        : 0 erreur            🔨
eslint     : 0 warning           🔨
vitest     : 488/488 (73 files)  🧪
seed       : 8 propriétés + 3 comptes 🔍/
/api/health: { ok: true }        ▶️
```

---

## Phase A — i18n dashboard (sélecteurs + durcissement) — niveau S

### Q1. Quels fichiers utilisent directement le composant concerné ?
- `LanguageSelector` (`src/components/language-selector.tsx`) : appelé uniquement par
  `src/components/layout/header.tsx:73` (header **public**). 🔍
- `CurrencySelector` (`src/components/currency-selector.tsx`) : appelé uniquement par
  `src/components/search-price-filter.tsx:36` (recherche **publique**). 🔍
- `DashboardSidebar` / `DashboardMobileHeader` : consomment `useT()` mais **n'embarquent aucun
  sélecteur**. 🔍
- `scripts/check-i18n.mjs` : regex accents uniquement ; scan
  `src/app/(main)`, `src/app/(auth)`, `src/app/dashboard`, `src/components`. 🔍

### Q2. Qui l'utilise indirectement ?
- `UiLocaleProvider` (racine, `src/app/layout.tsx`) : déjà appliqué à tout le dashboard —
  aucun câblage supplémentaire nécessaire. 🔍
- `useDisplayPreferences()` (`src/lib/use-display-currency.ts`) : résout la devise/langue
  compte > localStorage > plateforme. C'est le seul point d'entrée des préférences d'affichage. 🔍

### Q3. ViewModel ?
Sans objet (pas de ViewModel ; App Router + hooks React).

### Q4. Écrans impactés ?
- `/dashboard/*` (+ sections billing/analytics) via la sidebar/mobile header.
- `/recherche` et l'accueil **inchangés** (selectors publics déjà présents).
- Aucun écran public du tunnel de réservation modifié.

### Q5. Workers / Services ?
`scripts/cron-runner.mjs` non touché. `check-i18n.mjs` (garde-fou CI) modifié — impact
**uniquement** sur l'outil de CI, pas sur le runtime.

### Q6. Tests existants couvrant la fonctionnalité ?
- `src/lib/use-display-currency.test.ts` (résolution priorité) 🔍
- `src/lib/ui-strings.test.ts` (parité FR/EN) 🔍
- `src/lib/ui-language.test.ts`, `src/lib/ui-currency.test.ts` 🔍
- `scripts/smoke.sh` (assertions #95, navigation) 🔍

### Q7. Nouveaux tests à créer ?
- Component/unit : sélecteur de devise qui PATCH `/api/users/me` (mutation correcte, rollback).
- `check-i18n.mjs` : fixtures avec mots français non accentués → détection.
- Smoke : présence des sélecteurs dans le dashboard, bascule langue FR/EN sur `/dashboard`.

### Q8. Risques de régression ?
- **Faible** : ajout de composants réutilisables existants, aucun changement du tunnel.
- ⚠️ **Piège** : `CurrencySelector` public utilise `localStorage` + `window.location.reload()`.
  Pour un **compte connecté**, `useDisplayPreferences` privilégie `user.currency` → le sélecteur
  localStorage **serait inopérant** pour un hôte/admin. Il faut **PATCH `/api/users/me {currency}`**
  (comme le fait `LanguageSelector` pour la langue). Écart de conception à traiter en Phase A.
- ⚠️ **Piège** : `PATCH /api/users/me` accepte `DISPLAY_CURRENCIES` (EUR/USD/GBP/CHF/MAD/XAF) mais le
  panneau admin `supportedCurrencies` est limité à EUR/USD/GBP/XAF. Le sélecteur dashboard doit se
  **borner** aux devises réellement supportées par le panneau (EUR/USD/GBP/XAF) pour rester cohérent.

### Q9. Revérifier après modification ?
- Dashboard (sidebar + header mobile) en FR et EN.
- Bascule de langue et de devise uniques `PATCH /api/users/me` → rechargement.
- `i18n:check` et `eslint` sur `src/components` + `src/app/dashboard`.

---

## Phase B — Conversion des devises (dashboard hôte + admin) — niveau S

### Q1. Appelants directs
- `sumByCurrency` / `formatCurrencyBreakdown` / `topCurrency` (`src/lib/currency-summary.ts`) :
  appelés par `dashboard/page.tsx`, `dashboard/billing/page.tsx`, `dashboard/analytics/page.tsx`. 🔍
- `convertAmount` / `formatMoney` / `formatPrice` (`src/lib/i18n.ts`, `src/lib/utils.ts`).
- `formatPrice(..., "EUR", ...)` en dur dans :
  `src/app/(main)/mon-compte/account-client.tsx:264`,
  `src/components/bestrewards-status.tsx:85`,
  `src/components/promotion-form.tsx:212` (commentaire), `src/components/promo-code-input.tsx:30`. 🔍
- `dashboard/properties/[id]/page.tsx:540` → `formatPrice(..., room.currency ?? "EUR", locale)` (devise
  chambre, non converti). 🔍

### Q2. Indirect
- `LocalizedRoomPrice` (`src/components/localized-room-price.tsx`) : déjà le pattern de conversion
  public (affichage seule, note « conversion indicative »). C'est la référence à réutiliser.

### Q3/Q5. ViewModel / Workers
Sans objet / non touché.

### Q4. Écrans
- `/dashboard/billing`, `/dashboard/analytics`, `/dashboard` (vue d'ensemble), `/dashboard/properties/[id]`.
- `(main)/mon-compte`, `bestrewards-status`, `promotion-form`, `promo-code-input` (résidus EUR).

### Q6. Tests existants
- `src/lib/currency-summary.test.ts` 🔍
- `src/lib/wallet-currency.test.ts` 🔍
- `src/lib/i18n.test.ts` (convertAmount, devises zéro-décimal) 🔍
- `src/lib/ui-currency.test.ts`, `src/lib/use-display-currency.test.ts`

### Q7. Nouveaux tests
- `sumByCurrencyConverted` : 2 devises → total converti + indicateur multi-devises.
- `formatCurrencyConverted` : mono-devise (rendu = natif, non-régression) et multi-devises.
- Résidus EUR : le wallet s'affiche en devise d'affichage convertie.

### Q8. Risques de régression
- **Moyen** si on convertit des montants **transactionnels** → **interdit** (règle T-132 : seul
  l'affichage est converti, jamais le paiement/remboursement/wallet débité). Toute conversion reste
  indicative. Le wallet (`walletCreditsUsed`) est **stocké en EUR** : l'**affichage** peut être
  converti en devise d'affichage, mais **la valeur débitée/restituée reste en EUR** (déjà le cas).
- **Faible** car EUR reste le cas réel → le total converti = total natif.

### Q9. Revérifier
- billing/analytics en EUR (mono-devise) → rendu identique.
- billing/analytics avec multi-devises (EUR+XAF) → total converti + détail natif toujours visible.
- No shadowing : ne pas masquer un mélange de devises réel.

---

## Phase C — Versement hôte/admin (Stripe Connect) — niveau C

### Q1. Appelants directs
- `bookings.netToHost`, `bookings.commissionAmount`, `bookings.commissionRate` : déjà persistés
  lors de la création (`src/app/api/bookings/route.ts`) 🔍.
- `dashboard/billing/page.tsx` (invoices = `[]` forcé) + `/api/dashboard/billing/export/route.ts`
  (CSV opérationnel, **pas** un état de payout) 🔍.
- `getPaymentProvider` (`src/lib/payment/index.ts`) : `stripe` | `mock`, **aucun** Connect 🔍.
- Aucune table `payouts`, aucun champ bancaire dans `users` 🔍.

### Q2. Indirect
- `payment-intents.ts` (création/rattachement intent), `payment-events.ts` (webhook/refund),
  `booking-confirmation.ts` (emails). Toute modification du flux de paiement impacte ces trois
  modules — à traiter **additivement**.

### Q3/Q5. ViewModel / Workers
- `scripts/cron-runner.mjs` : point d'accroche naturel pour un job de versement périodique.

### Q4. Écrans
- `/dashboard/billing` : nouvelle section « Versements » (remplace `invoices=[]`).

### Q6. Tests existants
- `src/lib/payment/index.test.ts`, `src/lib/payment-intents.*`, `src/app/api/bookings/route.test.ts`,
  `src/app/api/webhooks/stripe/route.test.ts`, `src/app/api/bookings/[id]/payment/route.test.ts`. 🔍

### Q7. Nouveaux tests
- Migration additive (table `payouts`) sur chaîne fraîche.
- `aggregatePayouts(bookings, period)` : répartition par devise + commission + net (unitaires purs).
- Idempotence d'un payout (même période, même `idempotencyKey`).
- UI billing : affichage d'un payout `pending`/`paid`.

### Q8. Risques de régression
- **Critique** si on modifie le flux de paiement client sans connect account → **règle** : sans
  Connect account actif côté hôte, **le comportement actuel est préservé** (paiement direct
  plateforme, `netToHost` calculé mais pas encore reversé automatiquement).
- **Critique** : transfert **multi-devise** (Stripe Connect) → refus propre si devise incompatible
  (même philosophie que l'anti-devise-mixée).
- **Critique** : données bancaires (IBAN) → chiffrement AES-GCM via coffre `provider-credentials`,
  jamais réaffichées, audit_log.
- **Validé uniquement** la partie **interne** (modèle + ledger + UI + abstraction provider).
  L'exécution Stripe Connect réelle exige des clés de test **absentes** ici → je ne peux pas la
  marquer `VALIDÉ` (règle §13.5). Je le dirai explicitement.

### Q9. Revérifier
- Payment client **identique** sans Connect account (non-régression).
- `db:push` sur chaîne fraîche sans erreur ; migration additive.
- `tsc`/`eslint`/`vitest`/`build`/`smoke`/`ai:check`.

---

## Référentiel des preuves pour Q1/Q2/Q6 (commandes exécutées)

```
grep -rln "LanguageSelector" src                      → header.tsx
grep -rln "CurrencySelector" src                      → search-price-filter.tsx
grep -rln "formatPrice" src/app src/components        → ~40 fichiers (dont résidus EUR)
grep -rni "payout\|stripe connect\|iban\|transfer" src → 0 applicatif (hors navigation)
grep -n "invoices" src/app/dashboard/billing/page.tsx → [] forcé
```
