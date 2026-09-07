# Analyse — i18n, conversion de devises et encaissement hôte/admin

- **Date** : 2026-09-06
- **Périmètre** : projet `MyBestBooking` (Next.js 16 / App Router / React 19 / PostgreSQL 17 / Drizzle ORM)
- **Demande** : analyser le projet, vérifier ma fraîcheur sur les dernières corrections, puis
  (1) l'**internationalisation du dashboard hôte/admin** (le demandeur constate qu'elle semble
  absente), (2) la **conversion des devises** (mêmes écarts côté admin), (3) le **paiement client**,
  (4) le **versement/encaissement hôte et admin** en compte bancaire. Fournir un **plan non régressif**.

> ⚠️ Les documents `.ai/ARCHITECTURE.md`, `.ai/DATABASE.md`, `.ai/MISSION.md` référencent un
> **ancien projet Android/Kotlin (MobileCaisse)** et décrivent `src/` Android. Le référentiel
> réel de MyBestBooking est `src/app`, `src/components`, `src/db`, `src/lib` (voir
> `.ai/ARCHITECTURE_MYBESTBOOKING.md` et `.ai/PROJECT.md`). Toutes les conclusions ci-dessous
> sont issues des fichiers **réels** du Web, pas des documents d'archive.

---

## 0. Méthode

Lecture statique + commandes de preuve. Le sandbox ne persiste pas `node_modules`/`.next`, donc je
n'ai **pas pu rejouer** `tsc`/`build`/`vitest` ici ; je m'appuie sur les garde-fous de gouvernance
du dépôt (`npm run ai:check` → **19 OK / 1 warn / 0 fail**) et sur les preuves documentées
(`.ai/CURRENT_TASK.md`, `.ai/PROGRESS.md`, `.ai/STATE.md`).

---

## 1. État du projet et ma fraîcheur

### 1.1. Ce qui est livré et prouvé

- Stack : Next 16 (App Router), React 19, TypeScript strict, Drizzle ORM + `pg`, Tailwind 4,
  auth JWT (jose) + bcrypt + 2FA TOTP, Stripe (PaymentIntent + webhook), Resend (outbox), S3/R2.
- Rôles : `customer` / `host` / `admin` (contrôlés côté handlers API).
- **14 tables métier** dans `src/db/schema.ts` (users, properties, rooms, rate_plans,
  room_availability, bookings, reviews, wishlists, conversations/messages, promotions,
  provider_credentials, app_settings, audit_log, price_alerts, referral…).
- Grosse base de tests documentée : ≈ **484 tests Vitest**, `smoke` **95/95**, `build` 60/60,
  `eslint` 0 warning, `tsc` 0, `i18n:check` 0 candidat, `ai:check` 19/0/0.
- **Dernière tâche validée (T-194, 2026-09-02)** : accès démo en un clic sur `/connexion`
  (3 boutons utilisant le flux de login normal). **Confirmée présente dans le code**
  (`src/app/(auth)/connexion/login-client.tsx` → `handleDemoLogin`, `auth.demoHint` ;
  `scripts/smoke.sh` → assertion #95).

### 1.2. La nuance importante sur l'état

- `git log` du dépôt ne montre qu'**un seul commit** (`2aedff4` « chore: update booking platform »),
  alors que `.ai/STATE.md` / `.ai/CURRENT_TASK.md` référencent `53decd2` (T-194). C'est un
  **écart d'historisation** (le dépôt racké est une branche d'archive), pas un écart de contenu :
  le code de T-194 est bien présent. Le frame `ai:check` le signale en `warn` uniquement (non bloquant).
- **Conclusion sur la fraîcheur** : je suis **à jour sur les dernières corrections** au niveau du
  **code** (jusqu'à T-194 incluse). Je ne peux pas re-valider exécutable la chaîne CI dans ce
  sandbox, mais la cohérence du framework est verte.

---

## 2. Internationalisation (i18n) du dashboard hôte/admin

### 2.1. Ce qui est réellement en place (contrairement à l'intuition initiale)

Le dashboard **est déjà câblé** au système i18n. Preuves :

- **Provider global** : `src/app/layout.tsx` enveloppe tout (`UiLocaleProvider initialLanguage={locale}`),
  avec `locale` résolu par `getServerLocale()` (compte → header `x-ui-language` → cookies → settings → `fr`).
  Le dashboard hérite donc de ce provider (aucun câblage supplémentaire nécessaire).
- **Sidebar / header mobile** : `DashboardSidebar` et `DashboardMobileHeader` utilisent `useT()`
  (libellés `dash.*`).
- **Pages serveur** : `dashboard/page.tsx`, `billing`, `analytics`, `properties`, `properties/[id]`,
  `bookings`, `bookings/[id]`, `reviews`, `users`, `settings` utilisent toutes `makeT(locale)`.
- **Pages déléguées** (rooms, messages, audit → managers client) : `rooms-manager`, `messages-manager`,
  `audit-filter`, etc. utilisent `useT()`.
- **Dictionnaire** : `src/lib/ui-strings.ts` = **1422 clés FR = 1422 clés EN** (type `UiStringKey`
  verrouillé statiquement : `keyof typeof FR` associé à `EN: Record<UiStringKey,string>`).
  Dont **≈ 407 clés** pour les surfaces dashboard (`dash.*`, `billing.*`, `host.*`, `analytics.*`,
  `settings.*`, `properties.*`, `rooms.*`, `bookings.*`, `reviews.*`, `users.*`, `promotions.*`,
  `audit.*`, `prop.*`).
- **Garde-fou** : `npm run i18n:check` → **0 candidat** (il scanne `src/app/(main)`, `(auth)`,
  `dashboard`, `components`).

> ⚠️ Ce que je dois corriger dans le postulat du demandeur : **la traduction du dashboard hôte/admin
> existe** (fr/en) et le garde-fou CI est vert. L'impression « ce n'est pas existant » vient
> probablement d'un des points ci-dessous.

### 2.2. Les vrais écarts (ce qu'il manque)

| # | Écart constaté | Impact |
|---|---|---|
| **E1** | **Pas de sélecteur de langue dans le dashboard.** `LanguageSelector` n'est monté que dans le header **public** (`src/components/layout/header.tsx`). Dans `/dashboard/*`, un hôte/admin ne peut **pas changer de langue** depuis l'espace pro (il doit passer par son compte/session). | UX : la traduction existe mais n'est pas actionnable côté pro. |
| **E2** | **Pas de sélecteur de devise dans le dashboard.** `CurrencySelector` n'est monté que sur la recherche (`search-price-filter.tsx`). | UX : un pro ne peut pas choisir la devise d'affichage de ses analytiques. |
| **E3** | Le **heuristique `check-i18n.mjs` ne détecte que le français accentué** (regex `àâäéèêë…`). Du français **non accentué** (ex. « Total », « Actions », « Réserver » s'écrit pareil, mais « Voir », « Modifier », « Supprimer », « Annuler », « Prix ») ou des libellés métier restant en français **passent le garde-fou**. | Risque de faux « 0 candidat ». |
| **E4** | **Contenus métier stockés en DB non traduits** : noms de propriétés, descriptions `description`/`descriptionEn`, noms de chambres, motifs d'annulation saisis par l'admin. Le tunnel public applique `pickLocalized(...)` (fr/en) sur `descriptionEn` ; le dashboard affiche souvent le **nom brut** côté hôte (c'est le bon comportement métier), mais un hôte peut livrer une fiche **uniquement en français** (champ `descriptionEn` vide). | Pas un bug, un choix produit — mais à documenter. |
| **E5** | Clés dashboard **peut-être couvertes en EN mais non vérifiées en runtime** (le `i18n:check` vérifie les accents, pas la présence d'une clé dans le RSC au rendu). | La compilation TypeScript `UiStringKey` garantit déjà que chaque clé `t(...)` existe. Faible risque résiduel. |

**Verdict i18n** : l'**infrastructure est là et fonctionnelle** (fr/en sur tout le dashboard) ;
l'écart principal est **l'absence de sélecteur de langue et de devise dans l'espace pro** (E1/E2)
et la **couverture heuristique du garde-fou** (E3). Aucun écran dashboard en français « dur »
n'a été trouvé par les scans ; les seuls « dur » sont des libellés de données métier (E4).

---

## 3. Conversion des devises (dashboard hôte + admin)

### 3.1. Ce qui est en place

- **Côté client/public** : la devise d'affichage est **résolue et convertie**.
  `useDisplayPreferences()` (`src/lib/use-display-currency.ts`) résout
  compte → localStorage → plateforme → `fr`. `LocalizedRoomPrice`
  (`src/components/localized-room-price.tsx`) convertit via `convertAmount()`
  (`src/lib/i18n.ts`, taux figés `RATES_FROM_EUR` : EUR 1, USD 1.08, GBP 0.85, CHF 0.94,
  MAD 10.9, XAF 655.957) et affiche la note « Conversion indicative · paiement en … ».
- **Devises gérées** : `SUPPORTED_CURRENCIES = EUR/USD/GBP/CHF/MAD/XAF`,
  `UI_CURRENCY_OPTIONS = EUR/USD/GBP/XAF`. Devises zéro-décimales (XAF/ZERO_DECIMAL) gérées
  pour Stripe (`toMinorUnits`).
- **Tunnel de réservation** : la réservation est **libellée dans la devise de la chambre**
  (`bookings.currency`), le wallet (crédits BestRewards en EUR) est converti via
  `applyWalletToTotal` (`wallet-currency.ts`).

### 3.2. Le vrai manque sur le dashboard hôte + admin

Le dashboard **n'effectue pas de conversion** vers une devise d'affichage : il traite les montants
**par devise de stockage** via `sumByCurrency()` / `formatCurrencyBreakdown()` (`currency-summary.ts`),
avec la règle explicite : **« on n'additionne JAMAIS deux devises ; jamais de somme inter-devises »**.

- `dashboard/billing` → `formatCurrencyBreakdown(...)`, `formatPrice(booking.netToHost, booking.currency, locale)`.
- `dashboard/analytics` → `formatCurrencyBreakdown(...)`, `topCurrency(...)` pour le graphique.
- `dashboard/page.tsx` (vue d'ensemble) → `sumByCurrency` / `formatCurrencyBreakdown`.
- `dashboard/properties/[id]` → `formatPrice(parseFloat(room.basePrice), room.currency ?? "EUR", locale)`
  — donc **prix/nuit dans la devise de la chambre**, pas converti.

**Conséquence** : pour un hôte dont les chambres sont en EUR et en XAF, le dashboard affiche
**deux montants séparés** (« 1 200,00 € + 785 000 XAF »), jamais un total unifié. C'est **un choix
de sécurité financière** (ne jamais mélanger des devises), mais c'est réellement ce que le
demandeur perçoit comme « pas de conversion des devises, même pour l'admin ».

### 3.3. Autres montants encore codés en **dur en EUR** (source `.ai/KNOWN_LIMITATIONS.md`)

- **Wallet** dans `(main)/mon-compte/account-client.tsx` → `formatPrice(parseFloat(user.walletBalance || "0"), "EUR", locale)`.
- **`bestrewards-status.tsx`** → `formatPrice(Number(wallet), "EUR", locale)`.
- **`promotion-form.tsx`** → seuils/plafonds libellés EUR (commentaire l.212).
- **`localized-room-price`** côté public gère la conversion, mais **`dashboard/properties/[id]`**
  reste en devise chambre pour l'admin/hôte.
- **`promo-code-input.tsx`** → `currency` par défaut `"EUR"` (mais il accepte déjà une devise passée).

---

## 4. Paiement client (payer un hébergement) — ✅ fonctionnel

Le parcours client est **implémenté et complet** :

1. `POST /api/bookings` (`src/app/api/bookings/route.ts`) valide disponibilité/capacité, calcule
   `subtotal/taxes/fees/discount/total`, **verrouille** la ligne chambre, committe le booking
   `pending` avec `paymentExpiresAt` (15 min) ; puis **hors transaction** crée le PaymentIntent.
2. `createPaymentIntentForBooking` (`src/lib/payment-intents.ts`) → `getPaymentProvider()` = `stripe`
   (si `STRIPE_SECRET_KEY`+`WEBHOOK_SECRET`) sinon `mock` (dev). Idempotence via
   `booking-intent:{bookingReference}`. Devises zéro-décimales correctes (`toMinorUnits`).
   Si `total ≤ 0` (promo/crédits couvrant tout) → confirmé sans PSP.
3. `POST /api/bookings/[id]/payment` → reprise propriétaire (retrieve du même intent).
4. **Client :** `StripePaymentForm` (`src/components/stripe-payment-form.tsx`) → `stripe.confirmPayment`
   (Stripe Elements, `redirect: if_required`) avec `clientSecret`).
5. **Webhook** `POST /api/webhooks/stripe` → `verifyWebhook` (HMAC, timestamp, anti-replay),
   `recordPaymentEvent` (inbox idempotente) puis `processPendingPaymentEvents` → booking `confirmed`/`paid`,
   confirmation email, libération des avantages.
6. **Compensation** : annulation tardive → `refundLateCapturedPayment` (`payment-events.ts`) idempotent.
7. Reprise cron des intents non rattachés (`recoverPendingPaymentIntents`).

> ✅ Le client **peut payer un hébergement**. Le mode invité (`guest`) et le wallet/promo sont gérés.
> Le paiement est toujours dans la **devise de la chambre** ; l'affichage côté public convertit seul.

---

## 5. Versement / encaissement hôte et admin — ❌ ABSENT (le vrai manque)

### 5.1. Constat

- **Aucun mécanisme de versement** : recherche `payout|transfer|stripe connect|account|bank|iban|
  disbursement|external_account` → **0 résultat applicatif** (seulement du code de « destination »
  de navigation, ou des mentions explicites « non implémenté »).
- **Aucun Stripe Connect** : le provider (`src/lib/payment/stripe.ts`) ne fait que
  `payment_intents` / `refunds` / `verifyWebhook`. Pas de `account` (Connect), pas de `transfer`,
  pas de `cancel` du paiement au-delà de l'annulation de l'intent.
- **Aucune colonne bancaire** dans `users` (ni `iban`, `bankAccount`, `payoutMethod`, `stripeAccountId`).
- **Le `booking` porte déjà la comptabilité** : `commissionRate`, `commissionAmount`, `netToHost`
  sont **calculés et persistés** (voir `src/app/api/bookings/route.ts` et le schéma `bookings`).
  Le `dashboard/billing` **affiche** `netToHost`, `commission` et un **export CSV**
  (`/api/dashboard/billing/export`) — mais **commentaire explicite** : « Export opérationnel, pas une
  facture légale ni un état de payout ».
- **Page billing** : section `invoices` **forcée à `[]`** avec `billing.invoicesSoon` /
  `billing.invoicesUnavailable` (l.~140 `src/app/dashboard/billing/page.tsx`) et
  `billing.commissionBody` EN = « …Legal invoices and the **payout calendar are not automated yet**. »

### 5.2. Pourquoi ce n'est pas fait

- `.ai/ADR/ADR-009` : « Journal comptable complet … **modèle légal/payout non défini ; reporté. »**
- `.ai/PROGRESS.md` (~l.791) : « **⏸️ Non implémenté** (ressources externes non simulables) :
  **Stripe Connect / versements bancaires hôtes** … le code bascule dès que les clés Stripe sont fournies. »
- `.ai/KNOWN_LIMITATIONS.md` : validation Stripe réelle non exécutée dans le sandbox
  (pas de clés test) ; `billing.commissionBody` le confirme.

### 5.3. Ce qui manque précisément pour « recevoir sur un compte bancaire »

Pour qu'un hôte/admin **reçoive** le produit net (`netToHost`) sur son compte :

| Brique | État actuel | À faire |
|---|---|---|
| Collecte du **moyen de versement** (IBAN/SEPA, Stripe Connect account, PayPal) de l'hôte | ❌ absent | Table/perso + onboarding connect (Stripe Express) |
| **Split/transfert** du paiement client (`total`) entre plateforme (commission) et hôte (`netToHost`) | ❌ absent (un seul PaymentIntent `payment_intents`) | Stripe **Connect** : `destination`/`transfer` + `application_fee_amount` (ou paiement direct au Connect account) |
| **Ledger de versement** (montants dus par période, statut pending/paid) | ❌ absent (CSV « opérationnel » seulement) | Table `payouts` + statuts + idempotence |
| **Exécution du versement** (batch vers Connect / SEPA) | ❌ absent | Job cron + webhook `payout.*` |
| **Historique/états** visibles coté hôte/admin | ❌ absent (`invoices=[]`) | UI billing « Versements » |
| **Rapprochement / TVA / facture légale** | ➖ partiel (moteur comptable hors périmètre) | Optionnel, hors périmètre MVP |

---

## 6. Plan non régressif

> Cadre de gouvernance : `.ai/CODING_RULES.md` impose pour une tâche **S/C** une **analyse d'impact**
> amont, proportionnalité T/L/S/C, et une règle de clôture (typecheck + build + tests + zéro
> régression). Les phases ci-dessous respectent : **additif**, **aucune migration destructive**,
> **contrats API préservés**, **EUR reste le cas réel** (rendus identiques), **gates par étape**.

### Phase A — i18n dashboard : sélecteurs + durcissement (niveau S, faible risque)

1. **A1 — Sélecteur de langue dans l'espace pro.** Monter `LanguageSelector` (réutilisable) dans
   `DashboardSidebar` + `DashboardMobileHeader`. Non régressif : le composant existe déjà, il fait
   `PATCH /api/users/me {language}` puis recharge `?lang=`. Tests : smoke sur navigation dashboard FR/EN.
2. **A2 — Sélecteur de devise dans le dashboard** (affichage uniquement). Réutiliser
   `CurrencySelector`. ⚠️ **Contrainte financière** : le sélecteur **ne convertit que l'affichage** ;
   le paiement, les totaux de réservation et le portefeuille **restent** dans la devise de la chambre
   (déjà le cas côté public). Ajouter la note « conversion indicative » aux totaux convertis.
3. **A3 — Durcir `check-i18n.mjs`.** Ajouter la détection de mots français **non accentués**
   (liste de lexique pro : « Voir », « Modifier », « Supprimer », « Annuler », « Prix », « Total »,
   « Actions »…) en plus de la regex accents, et élargir le scan aux **managers client** du dashboard.
   Objectif `i18n:check --strict` = 0.
4. **A4 — Résidualité** : migrer les derniers montants codés en dur **EUR** (E3 : wallet
   `mon-compte`, `bestrewards-status`, `promotion-form`, `promo-code-input`) vers `displayCurrency`
   **en n'affichant que la conversion**, jamais en convertissant la transaction.

**Gates A** : `tsc` 0 · `eslint` 0 · `i18n:check --strict` 0 · `vitest` vert · build ✓ ·
smoke ✓ · `ai:check` 19/0/0. **Non-régression** : EUR par défaut = rendu identique ;
aucun changement du tunnel (aucune conversion transactionnelle ajoutée).

### Phase B — Conversion de devise des totaux dashboard (affichage, niveau S)

1. **B1 — Helper d'agrégat converti** dans `currency-summary.ts` :
   `sumByCurrencyConverted(items, targetCurrency, rates)` qui, **en plus** de la répartition par devise,
   fournit un **total converti en devise d'affichage** (via `convertAmount`/`RATES_FROM_EUR`) avec
   un indicateur « multi-devises ».
2. **B2 — Afficher le total converti** dans `billing` (revenue net) et `analytics` (revenue 30 j,
   panier moyen) **en conservant** la répartition native (`formatCurrencyBreakdown`) comme détail,
   pour ne jamais masquer un mélange de devises réel.
3. **B3 — Nouvelle clé i18n** : mention « Total converti (indicatif) » + note d'avertissement
   multi-devises. Ajouter en FR + EN (le type `UiStringKey` force la parité).
4. **B4 — `dashboard/properties/[id]`** : afficher le prix/nuit en **devise d'affichage convertie**,
   avec note « conversion indicative · paiement en {devise chambre} » (réutiliser le pattern
   `LocalizedRoomPrice`).

**Gates B** : unitaires `currency-summary.test.ts` étendus (2 devises, tas égaux EUR/XAF), `vitest`
vert, `tsc/eslint/i18n` 0, smoke, build. **Non-régression** : en mono-devise (EUR), le total converti
= total natif → aucun changement visuel ; la répartition native reste toujours affichée.

### Phase C — Versement hôte/admin en compte bancaire (niveau C — structurant, nécessite Stripe Connect)

> ⚠️ **Niveau C** : ajout d'un **flux financier réel** (argent en mouvement) et de **données sensibles
> bancaires**. Une **analyse d'impact** dédiée + **débat technique multi-rôles** (voir
> `.ai/PROMPTS/roles.md`) sont obligatoires avant implémentation, conformément à `.ai/CODING_RULES.md`.

1. **C1 — Modèle de données (additif).**
   - Table `payout_accounts` : `userId` (host/admin), `provider` (`stripe_connect` | `sepa`),
     `stripeAccountId`, `iban` (chiffré AES-GCM comme le vault provider), `status`
     (`pending`/`verified`/`rejected`), `defaultCurrency`, timestamps.
   - Table `payouts` : `hostId`, `periodStart/End`, `grossAmount`, `commissionAmount`, `netAmount`,
     `currency`, `status` (`pending`/`processing`/`paid`/`failed`), `providerPayoutId`,
     `idempotencyKey` (unicité), `paidAt`, `createdAt`.
   - → Migration **additive** (aucune modification de table existante), testée sur chaîne fraîche.
2. **C2 — Collecte de l'account Stripe Connect** : endpoint `POST /api/host/payout-account`
   (onboarding Connect Express, ou saisie IBAN pour flux SEPA hors Stripe). Rate-limit + validation Zod.
   Vaultage des secrets via `provider-credentials`.
3. **C3 — Paiement client en « destination charge »** : quand le booking est créé et que **l'hôte a
   un Connect account actif**, créer le PaymentIntent avec `application_fee_amount = commission`
   et `transfer_data.destination = host.stripe_account_id` (Stripe Connect). ⚠️ **Règles impératives** :
   - **Never régressif** : sans Connect account actif côté hôte, **le comportement actuel est préservé**
     (paiement direct vers la plateforme, `netToHost` calculé mais en attente de versement manuel).
   - **Idempotence** : same `bookingReference` key (déjà en place).
   - **Devises** : le transfert Connect doit être dans une devise compatible (la devise du booking) ;
     sinon **refuser proprement** (même règle que l'actuel anti-devise-mixée).
4. **C4 — Ledger de versement** : job cron `payouts` (calqué sur le pattern `cron-runner`) qui
   agrège les bookings `paid` par période → crée un `payout` `pending` (idempotent), puis déclenche
   le transfert via Stripe (`payouts.create` / `transfers.create`).
5. **C5 — UI billing « Versements »** (hôte + admin) : tableau `invoices`/`payouts` réel (fin du
   `invoices=[]`), statuts + bouton « demander un versement » (si mode manuel) + export CSV enrichi.
6. **C6 — Webhook** `payout.*` (Stripe) : mettre à jour `payouts.status`, boîte inbox idempotente
   (réutiliser `paymentEventInbox`/générique ou table dédiée).
7. **C7 — Sécurité** : chiffrement des IBAN/accounts (AES-GCM, clé `CREDENTIALS_ENCRYPTION_KEY`),
   jamais refaffichés, journal d'audit (`audit_log`) sur chaque action de versement.

**Gates C** : `tsc` 0 · `eslint` 0 · `vitest` (unitaires C1/C3 idempotence + intégration ledger) ·
`db:push` sur chaîne fraîche + migration additive · `build` ✓ · `smoke` ✓ · `ai:check` ✓ ·
**preuves runtime** : onboarding Connect (si clés test), formation d'un payout `pending`, rejet
d'un transfert avec devise incompatible, absence de `payout` si pas de connect account (comportement
B de non-régression).

**Non-régression C** : le **paiement client reste identique** là où il n'y a pas de Connect account
(cas courant aujourd'hui) ; la page billing garde la répartition native ; aucune ressource existante
n'est renommée/supprimée ; `git diff --stat` controllé ; **tests ciblés** + smoke avant/après.

---

## 7. Synthèse des enjeux et manquements

| Thème | Enjeu | État | Plan |
|---|---|---|---|
| **i18n dashboard hôte/admin** | Pro doit pouvoir utiliser la plateforme fr/en | ✅ infra + dictionnaire (1422 clés FR=EN, `dashboard` inclus) ; **❌ pas de sélecteur langue dans l'espace pro** ; **⚠️ garde-fou ne détecte que l'accentué** | **Phase A** |
| **Conversion devises** | Ne jamais mélanger devises, mais offrir une lecture unifiée | ✅ public ; **⚠️ dashboard en répartition native** (`formatCurrencyBreakdown`) ; **⚠️ montants EUR codés en dur** (wallet, bestrewards, promo, prix/nuit `properties/[id]`) | **Phase B** |
| **Paiement client** | Le client paie l'hébergement | ✅ **complet** (Stripe PaymentIntent + webhook + mock + reprise + compensation) | — (rien à faire) |
| **Versement hôte/admin en compte bancaire** | L'hôte/admin doit **recevoir** `netToHost` sur son compte | ❌ **absent de bout en bout** (pas de Connect, pas de table, pas de ledger, pas d'exécution) ; seule la *comptabilité* (`netToHost`, `commission`) est calculée/exportée | **Phase C** |

---

## 8. Recommandations immédiates

1. **Prioriser la Phase C** (versement hôte/admin) : c'est le **plus gros manque produit** et il ne
   peut pas être contourné par de l'UI — il faut Stripe **Connect** et une **table de paiements**.
   Commencer par une **analyse d'impact** dédiée + un **débat technique multi-rôles** (exigence
   gouvernance pour un niveau C).
2. **Phase A + B en parallèle** (faible risque) : elles rendent l'espace pro **utilisable** (langue,
   devise d'affichage) sans toucher au tunnel de paiement ni à la finance transactionnelle.
3. **Ne jamais convertir un montant transactionnel** : toutes les conversions restent **indicatives,
   à l'affichage uniquement**, en conservant la devise native de stockage (règle existante `T-132`).
4. **Documenter** les choix dans `.ai/REPORTS/` (conforme au framework) et **mettre à jour**
   `.ai/KNOWN_LIMITATIONS.md` en retirant « Stripe Connect non implémenté » une fois la Phase C validée.
