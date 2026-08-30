# Audit fonctionnel profond n°26 — scénarios & éléments inachevés ou mal pensés (à l'exécution)

**Date :** 2026-08-30
**Branche :** `arena/01a052ed-mybestbooking` (base `ed19ac3` — T-153 livré/validé)
**Méthode :** crawls HTTP réels sur **38 pages × 4 rôles** (152 vérifications,
`.data/a26/pages.json`, 0 marqueur d'erreur) + **60 routes API** (120
vérifications, `.data/a26/apis.json`, zéro ERR/500) + lecture ciblée des flux
critiques (recherche/filtres prix, réservation→paiement→annulation, avis,
favoris, wallet, alertes prix, messagerie, calendrier, promos, cashback
BestRewards, devises, admin) + **tests de parcours de bout en bout réels**
(`curl` avec sessions customer/host/admin). Pour chaque écart :
**problème → preuve runtime → solution sans régression**. Aucune modification
de code dans ce rapport.

---

## ✅ Ce qui est sain (vérifié à l'exécution)

- **Pages : 152 vérifications, 0 erreur.** Les 307 sont tous attendus :
  anonyme → `/connexion?next=…` (18 pages dashboard + mon-compte + favoris +
  réservations + messages) ; customer → `/` sur tout `/dashboard` et
  `/connexion`/`/inscription` ; host → `/dashboard` sur les pages admin-only
  (audit, promotions, settings, users) ; admin → `/connexion`+`/inscription`
  uniquement. RBAC page conforme.
- **APIs : 120 vérifications, zéro ERR/500.** Les 401/403/405/400 observés
  correspondent aux contrats (règles de droit re-détaillées en fin de rapport).
- **Réservation → paiement → annulation (E2E, mock provider)** : `POST
  /api/bookings` 201 (réf. MBB-2026-N7XHOA, 2 nuits, subtotal 237,34 · taxes
  23,73 · discount 39,16 (15 % BestRewards) · total 221,91 EUR, paymentStatus
  `paid`) ; `GET /api/bookings/[id]/invoice` → PDF HTML correct avec devise
  de la réservation ; `GET …/cancellation` → devis (frais 0,00 à J-163) ; `PUT
  /api/bookings/[id] {status:cancelled}` → `cancelled` + `refundStatus:
  refunded` + `refundAmount 221,91`. **Flux complet OK** (le devis d'annulation
  est bien appelé par l'UI avant confirmation).
- **Promos cross-devises (T-153 B)** : `GET /api/promotions/apply` →
  BIENVENUE10 sur 261,07 EUR = −26,11 (10 %) ; **LASTMINUTE (20 € fixe) sur
  200 USD = −21,60 $US** ; sur 500 000 XAF = −13 119,14 FCFA. Conversion
  correcte, `currency` renvoyé. **OK.**
- **Wallet cross-devise (T-153 A)** : POST /api/bookings applique
  `applyWalletToTotal` et stocke `walletCreditsUsed` en EUR (restitution
  idempotente vérifiée dans `releaseBookingBenefits` et le cron) ; l'aperçu de
  la page de réservation utilise la même fonction. **OK.**
- **Recherche amenities** : `?amenity=pool` → 4 propriétés, identique au SQL
  `@> '["pool"]'` ; `?amenity=kitchen` (non exposée dans l'UI) filtre
  correctement à la main. **Fonctionnel** (voir P3-4 pour l'inventaire UI).
- **Messagerie E2E** : POST /api/conversations → conversation créée (clé
  `property:…:user:…`, idempotente) ; POST /api/messages → message lu dans
  `/messages/[id]` ; `/messages` 200 et `/dashboard/messages` 200. **OK** (états
  vides corrects : « Envoyez votre premier message ci-dessous » /
  « Aucune conversation »).
- **Perf candidat (35,6 s)** : **écart invalidé** — c'était un cold-start
  Next dev (1er appel compilé). Après warm-up : `GET /api/bookings/[id]` =
  **77 ms / 24 ms / 38 ms** (3 appels). Rien à changer.
- **`GET /api/users/me` 405** : **écart invalidé** — la route est
  PATCH/DELETE-only ; le front lit le profil via `GET /api/auth/me` (expose
  bien `currency`, `language`, `emailVerified`, `walletBalance`, etc.) et
  `useDisplayPreferences` l'utilise. `POST /api/auth/login` ne renvoie que
  `id/email/firstName/lastName/role` : suffisant (l'UI redirige par rôle puis
  recharge la page RSC). Aucun bug.
- **Recherche : bornes `displayCurrency`** : `maxPrice=60000&displayCurrency=XAF`
  → 3 propriétés = `maxPrice=91&displayCurrency=EUR` ; `70000 XAF` → 4.
  La conversion des bornes fonctionne (voir P1-1/P1-2 pour le reste).
- **Alertes prix** : la devise est portée UI → POST → quote (filtre
  `rooms.currency`) ; la liste `/api/price-alerts` renvoie la devise stockée et
  l'UI l'affiche. **OK** (limite P2-4 documentée ci-dessous).

---

## 🔴 P1 — Findings critiques

### 1. Recherche : le prix « à partir de » n'est **jamais affiché** (« Prix indisponible » sur toutes les cartes)

**Problème.** `src/app/(main)/recherche/page.tsx` calcule `minPrice` /
`minCurrency` via deux sous-requêtes corrélées placées **dans la liste SELECT**
(`eligiblePrice`, l. ~130-147). Drizzle ORM rend la référence à la table
externe **sans son qualificatif** dans ce contexte : `r2.property_id = "id"`
au lieu de `r2.property_id = "properties"."id"`. Postgres résout alors `"id"`
sur la table interne (`rooms r2` a une colonne `id`) → la condition devient
`r2.property_id = r2.id` → toujours fausse → la sous-requête renvoie **NULL**
pour toutes les propriétés → `minPrice: null` → la carte affiche
« Prix indisponible ». La même sous-requête utilisée dans `WHERE` (EXISTS) et
`ORDER BY` est rendue **correctement qualifiée** (`"properties"."id"`) — c'est
pourquoi le filtrage par `maxPrice` et le **tri par prix fonctionnent** alors
que l'affichage du prix est cassé. (Bug d'expression Drizzle, pas de SQL
dans le code : tout est paramétré.)

**Preuves (runtime).**
- `curl /recherche` (aucun filtre) : 8 cartes, toutes avec
  **« Prix indisponible »** (`grep -o "Prix indisponible" = 8` ; `€` dans le
  HTML des cartes = 0). Payload RSC : `"minPrice\":null,"minCurrency\":null`
  pour les 8 résultats.
- Reproduction du **SQL exact** généré (script `.data/a26/repro-search.ts`,
  drizzle `toSQL()`) :
  `… (SELECT r2.base_price FROM rooms r2 WHERE r2.property_id = "id" AND
  r2.is_active = true ORDER BY r2.base_price ASC …) …`
  alors que l'EXISTS du WHERE produit `r2.property_id = "properties"."id"`
  (correct). Exécution : `minPrice` NULL pour les 8 propriétés.
- La même requête en SQL brut (équivalent littéral, qualificatif correct)
  renvoie bien `Hôtel Le Magnifique 118,67 EUR`, `Riad 100,00 USD`, etc.
- La fiche propriété (`/hebergement/hotel-le-magnifique`) affiche bien
  « 118,67 € /nuit » (2 occurrences) → l'anomalie est **spécifique à la page
  de recherche** (sous-requêtes de projection).
- Tri : `/recherche?sort=price_asc` = 89, 89, 89, 92,59 (USD), 118,67, …
  et `price_desc` = inverse — confirmant que `ORDER BY` (même expression)
  est qualifié correctement, preuve du caractère contextuel du bug Drizzle.

**Impact.** Fonction cœur : jamais de prix sur les résultats ; la mention
« conversion indicative » (T-131) ne s'affiche pas non plus ; la
différenciation tarifaire du comparateur est invisible. P1 UX.

**Solution sans régression (additive, interne à la page).**
Remplacer les deux sous-requêtes corrélées de la projection par une **requête
annexe en 2 temps** (aucun changement de contrat public, aucun schéma) :
1. Conserver exactement la requête actuelle (WHERE EXISTS, tri, pagination) —
   elle est correcte.
2. Avec les `property.id` retournés (≤ 20), une seconde requête :
   `SELECT property_id, base_price, currency FROM rooms WHERE is_active =
   true AND property_id = ANY($1)` puis calcul en JS du **plus petit prix
   normalisé en EUR** (mêmes taux `RATES_FROM_EUR`, valeur + devise affichée)
   par propriété, et rattachement aux cartes.
3. Bonus de correction (voir P1-2) : le « prix à partir de » doit être le min
   **en EUR** (`convertAmount`), pas le min brut multi-devises
   (`ORDER BY base_price` actuel peut choisir 140 € plutôt que 150 $US ≈
   138,89 €).
4. Ajouter un test d'intégration RSC : « la carte affiche toujours un prix
   quand le bien a au moins une chambre active ».
Alternative équivalente (si l'on préfère une seule requête) : sous-requête
LATERAL ou `GROUP BY` avec alias — mais la variante 2 temps est la plus
simple et ne dépend pas d'un comportement de rendu Drizzle.

---

### 2. Recherche : le filtre « prix min » est sémantiquement faux (et `max` ne l'est que par coïncidence)

**Problème.** `eligibleRoomPredicate` (l. ~52-89) applique les bornes à
« **il existe au moins une chambre** satisfaisant la borne » :
`EXISTS (… AND priceEur >= min …)`. Or l'intention produit (et l'affichage
carte, « à partir de ») est : **la chambre la moins chère du bien doit être
dans la fourchette**. Pour `max`, les deux sémantiques coïncident
(`∃ room ≤ max` ⟺ `min(room) ≤ max`). Pour `min`, elles divergent :
`∃ room ≥ min` ⟺ `max(room) ≥ min` → **tout bien ayant au moins une chambre
chère passe**, même si son offre « à partir de » est en dessous du minimum.

**Preuves (runtime).**
- `/recherche?minPrice=107` (EUR) → **8 propriétés** (dont B&B Toscana,
  Appartement Montmartre, Dar El Medina dont la plus petite chambre est
  **89 €** < 107 € — elles ne devraient pas apparaître).
- `/recherche?maxPrice=91&displayCurrency=EUR` → **3 propriétés** (89 €) —
  cohérent.
- SQL vérifié (pg) : la condition `priceEur >= 107` en EXISTS renvoie bien les
  8 propriétés car chacune a au moins une chambre ≥ 107 € (129/148/159…).
- Même constat en XAF : `minPrice=60000&displayCurrency=XAF` → 8 ;
  `maxPrice=60000&displayCurrency=XAF` → 3.

**Impact.** Une personne qui cherche « moins de 100 € » voit des biens dont le
prix affiché réel (une fois P1-1 corrigé) serait ≥ 100 € — résultat trompeur
sur le filtre le plus utilisé ; l'asymétrie min/max est invisible pour
l'utilisateur. P1 (correctness) mais corrigeable avec P1-1.

**Solution sans régression.**
Ne plus tester la borne sur « une chambre quelconque » : tester la **chambre
la moins chère** :
- `WHERE EXISTS (… AND (SELECT MIN(price_eur) …))` — en pratique : réutiliser
  la **même** sous-requête « prix à partir de » que P1-1 (corrigée) dans le
  WHERE, ou calculer le min en JS dans la requête annexe puis filtrer en
  mémoire sur les ≤ 20 résultats + ajuster `count()` (`SELECT count(*)
  FROM properties WHERE …` devient `count` des propriétés filtrées après
  calcul du min). Pour rester additif et éviter un changement de contrat de
  pagination, la solution 2 temps de P1-1 suffit : on calcule le min par
  propriété, on filtre en JS selon les bornes **converties en EUR**
  (`priceBoundToStorage`, déjà en place), puis on pagine.
- Tests : `min=107` → 5 propriétés ; `max=91` → 3 ; fourchette `89–92` →
  les biens à 89 €/92,59 € ; comportement EUR inchangé quand les bornes sont
  absentes.

---

### 3. Cashback BestRewards : le chemin **« Terminer le séjour »** (l'UI hôte) contourne la conversion de devise (T-153 C incomplet)

**Problème.** T-153 C a ajouté le paramètre `currency` à
`calculateLoyaltyAward` et corrigé **un seul** caller (le cron
`/api/cron/price-alerts`). Le second caller —
`PUT /api/bookings/[id]` avec `{status:"completed"}` dans
`src/app/api/bookings/[id]/route.ts` (l. ~140) — appelle toujours
`calculateLoyaltyAward({…}, Number(lockedBooking.total), br.thresholds)`
**sans 4ᵉ argument** → `currency` vaut `"EUR"` par défaut, même pour une
réservation en USD/XAF/MAD. C'est pourtant **le chemin utilisé par l'UI** :
`booking-row-actions.tsx` → bouton « Terminer le séjour » → `PUT … {status:
"completed"}` (l. ~103-111). Le cron ne couvre que les séjours passés sans
clôture manuelle.

**Preuves (runtime/code).**
- `src/lib/loyalty.ts` (T-153) : `const totalEur = isDisplayCurrency(cur) &&
  cur !== "EUR" ? convertAmount(total, cur, "EUR") : total;` — le défaut
  `(currency ?? "EUR")` rend l'appel à 3 arguments **strictement identique à
  l'ancien comportement** : aucune conversion.
- `src/app/api/bookings/[id]/route.ts` l.132-159 : seul endroit qui écrit
  `cashbackAmount` hors cron — via `loyalty.cashback.toFixed(2)`.
- `src/app/api/cron/price-alerts/route.ts` l. ~55 : passe bien
  `booking.currency ?? "EUR"` (correct) — la divergence entre les deux callers
  est la preuve de l'oubli.
- DB : une chambre USD existe réellement (`Suite 100.00 USD`, Riad
  `8b6f7c72…`) → scénario atteignable ; un séjour 500 $US Ambassador au
  lieu de 462,96 € créditerait **25,00 €** au lieu de **23,15 €**.
- Tests unitaires `loyalty.test.ts` (T-153) prouvent que le 4ᵉ argument
  change le résultat : `200 USD → 185,19 € → cashback 9,26` (contre 10,00
  sans conversion).

**Impact.** Véracité monétaire du programme de fidélité par le chemin le plus
fréquent (clôture manuelle par l'hôte/admin) : surcrédit du wallet EUR pour
les devises > EUR (GBP ~17,6 % de surcrédit) et sous-crédit pour XAF/MAD.
P1 (directement T-153 C, régression de la promesse du ticket).

**Solution sans régression (1 ligne + tests).**
1. `src/app/api/bookings/[id]/route.ts` : passer
   `lockedBooking.currency ?? "EUR"` en 4ᵉ argument de `calculateLoyaltyAward`.
2. Tests d'intégration (route) : PUT `completed` sur une résa USD (montant
   200 $US, user Ambassador) → `cashbackAmount "9.26"` et
   `walletBalance +9,26 €` ; sur EUR → valeurs historiques inchangées
   (non-régression prouvée).

---

## 🟡 P2 — Findings de cohérence

### 4. Réservation : l'aperçu « Total » ne reflète jamais la réduction BestRewards, et hardcode la TVA (10 %)

**Problème.** Deux divergences entre l'aperçu client
(`src/app/(main)/reservation/page.tsx` l. ~133-150) et le calcul serveur
(`POST /api/bookings` l. ~230-270) :
1. **TVA** : le client fixe `const taxes = subtotal * 0.1` (l. 138) alors que
   le serveur utilise `getSetting("billing").taxRate` (défaut 0.10, **éditable
   par un admin** dans `/dashboard/settings`). Si un admin change le taux
   (ex. 8 %), l'aperçu affiche un total différent de celui facturé.
2. **BestRewards** : le serveur applique `bestrewardsPercent` (10/15 % + 2 %
   sur bien BestRewards, pouvant aller à 30 %) **sans aucune ligne dans
   l'aperçu client**. Le client affiche donc un total plus élevé que le
   montant réellement débité (et sa décision d'utiliser le wallet/un code
   promo se fait sur un mauvais socle).

**Preuves (runtime).**
- `POST /api/bookings` (customer niveau 2, Hôtel Le Magnifique, 2 nuits
  118,67 €) → réponse : `subtotal "237.34" · taxes "23.73" · discount
  "39.16" · total "221.91"` (39,16 = **15 % BestRewards** de 261,07).
- La page `/reservation?…` calcule et affiche (code + RSC) :
  `subtotal 237,34 + taxes 23,73 = 261,07 €` ; aucune mention
  « réduction BestRewards » (`grep BestRewards` dans le récap → absent) ;
  total affiché 261,07 € alors que le paiement réel est 221,91 €.
- `src/lib/settings.ts` : `billingSchema.taxRate` éditable (0→1), `DEFAULTS`
  = 0.1 → la divergence est latente mais réelle dès qu'un admin ajuste.

**Impact.** Confiance (on affiche plus cher que facturé — « bonne surprise »,
mais l'utilisateur peut renoncer, sous-utiliser son wallet, ou croire qu'un
code promo de -10 % s'applique au montant avant avantage) ; en cas de
changement de `taxRate`, la promesse « Prix confirmé avant paiement » est
fausse. P2.

**Solution sans régression.**
- Afficher la ligne de réduction BestRewards : soit lire le niveau/discounts
  via un endpoint de lecture existant, soit — plus simple et sans nouveau
  contrat — **déplacer le récap au serveur** : le POST /api/bookings renvoie
  déjà `subtotal/taxes/discount/total` ; faire en sorte que la **confirmation
  après paiement** soit la source de vérité affichée (c'est déjà le cas) et,
  pour l'aperçu, ajouter au GET `/api/properties/[id]` (déjà consommé par la
  page) les champs read-only `bestrewardsDiscountPercent` calculés côté
  serveur (additif), la page affichant alors « −15 % BestRewards (niveau 2) »
  et calculant la TVA avec `taxRate` renvoyé par le même endpoint. Aucun
  changement de contrat existant : champs optionnels ajoutés.
- Minimum acceptable sans API : remplacer `subtotal * 0.1` par la valeur
  renvoyée par le serveur (récap post-paiement) et afficher « total indicatif
  — le total exact est confirmé à la réservation ».

### 5. « Annulation gratuite » affiché pour **tout** séjour, alors que la politique réelle dépend du bien et du délai

**Problème.** `reservation/page.tsx` l. 851 affiche en dur
« ✅ Annulation gratuite » (et l. 837 « ✅ Aucun frais supplémentaire »), quel
que soit `property.cancellationPolicy` et la date d'arrivée. Le serveur, lui,
applique la grille (`computeCancellationFeeWithGrid` : `free` 0 % ;
`flexible` 0 % ≥ 24 h puis 100 % ; `moderate` 50 % < 5 j ; `strict` 50 % < 7 j
; `non_refundable` 100 %). La fiche propriété, de son côté, affiche pour
`flexible`/`moderate`/`strict` un badge « voir le tarif »
(`hebergement/[slug]/page.tsx` l. 341) — **ni l'un ni l'autre ne donne la
règle réelle**, et ils se contredisent.

**Preuves (runtime).**
- `/reservation?propertyId=…` → HTML : 2 × « Annulation gratuite » (l. 851) ;
  la propriété utilisée est `flexible`.
- `/hebergement/hotel-le-magnifique` → badge « voir le tarif » (clé i18n
  `property.cancellationSeeRate`) pour la même politique `flexible`.
- `GET /api/bookings/{id}/cancellation` → devis selon la grille serveur
  (`src/lib/cancellation.ts` DEFAULT_GRID) ; un séjour `strict` annulé à J-3
  serait facturé 50 % alors que la page de réservation a promis « gratuit ».
- DB : les 8 propriétés sont `flexible` aujourd'hui (le mensonge est donc
  latent), mais le formulaire hôte (`properties/new`) permet `strict` /
  `non_refundable` — le cas est atteignable à tout moment.

**Impact.** Engagements tarifaires contradictoires → litiges/avis négatifs ;
l'utilisateur ne peut pas décider en connaissance de cause. P2.

**Solution sans régression.**
- Dans `reservation/page.tsx` + `property-booking-card.tsx`, remplacer le
  texte dur par un libellé dérivé de `property.cancellationPolicy` (mapping
  free/flexible/moderate/strict/non_refundable → « Annulation gratuite » /
  « Gratuite jusqu'à 24 h avant » / « Gratuite jusqu'à 5 j, puis 50 % » /
  « Gratuite jusqu'à 30 j, puis 50 % » / « Non remboursable ») — avec en
  plus le rappel « voir Politique d'annulation » sur la fiche.
- La donnée est déjà disponible : `property.cancellationPolicy` est chargé
  par la page (`PropertyData`) — aucun appel réseau ni changement de contrat.
- Ajouter un test RSC / smoke : « la politique strict n'affiche jamais
  'Annulation gratuite' ».

### 6. Favoris : cœur « add-only » (pas de toggle), ajout silencieux dans la **première** liste, aucune suppression unitaire dans l'UI

**Problème.** Trois composants implémentent les favoris en réinventant le
flux : `property-card-client.tsx` (cartes recherche), `property-header-actions.tsx`
(fiche propriété) :
- le bouton ne fait qu'**ajouter** (`POST {wishlistId: liste[0], propertyId}`),
  sans jamais vérifier si le bien est déjà favori → au rechargement, l'état
  « déjà enregistré » n'est **jamais** reflété (pas de lecture de l'état
  initial, état local `saved` perdu au refresh) ;
- quand l'utilisateur a **plusieurs listes**, l'ajout va toujours dans
  `wishlists[0]` (ordre GET = `orderBy desc(createdAt)` → la plus récente) —
  choix silencieux, impossible de choisir la liste ;
- `/mes-favoris` rend `PropertyCard` (cœur add) → **impossible de retirer un
  bien** : la seule suppression offerte est celle de la **liste entière**
  (`WishlistActions`). L'API `DELETE /api/wishlists?wishlistId=…&propertyId=…`
  existe mais **aucun front ne l'appelle** (grep DELETE).

**Preuves (runtime/grep).**
- `grep -rn "method: \"DELETE\"" src/…` : seuls `wishlist-actions.tsx`
  (liste entière), `price-alerts-section`, `delete-account-section`,
  `settings-panel`, `s3` utilisent DELETE — aucun retrait d'item favori.
- `src/app/(main)/mes-favoris/page.tsx` l. ~140 : `wishlist.items.map((p) =>
  <PropertyCard property={p} />)` — même composant dont le cœur ajout.
- Runtime : `POST /api/wishlists` (add item) 201 ; `DELETE` sans query
  params → 400 « wishlistId requis » (le front ne l'utilise pas).
- Ajout réussi vérifié (item créé sur `eae00d3d…`), puis nettoyé.

**Impact.** UX « mal pensée » classique : l'utilisateur ne peut ni voir l'état
favori depuis la recherche, ni retirer un favori sans tout supprimer ; le
choix de liste est invisible. P2.

**Solution sans régression.**
1. Étendre `PublicPropertyCard`/props de `PropertyCardClient` avec
   `wishlistItemId?: string | null` (ou `alreadySaved: boolean`) calculé par
   les pages serveur (recherche, fiche, favoris) depuis la requête
   wishlists existante — additif.
2. Le bouton devient **toggle** : si `alreadySaved` → `DELETE
   ?wishlistId&propertyId` (route existante) puis retour à « idle » ; sinon
   comportement actuel (POST).
3. Sur `/mes-favoris`, rendre le cœur avec `alreadySaved` + libellé
   « Retirer » (aria-label) ; ou ajouter un bouton « Retirer » explicite par
   carte.
4. Factoriser le flux dans un hook unique (`useWishlistToggle`) pour
   supprimer la duplication card/fiche (aucun contrat modifié).

### 7. Alerte prix : filtre `rooms.currency` strict → alerte silencieusement morte si aucune chambre active dans la devise

**Problème.** `quotePriceAlert` (`src/lib/price-alert-quote.ts` l. ~56-58)
filtre `eq(rooms.currency, input.currency)`. Le POST accepte `currency`
optionnel → **défaut `"EUR"`**. Si la devise de l'alerte ne correspond à
**aucune** chambre active (ex. propriété dont la/les chambres sont USD, ou
chambre USD désactivée après création de l'alerte), `activeRooms` est vide →
`quote` `null` → le cron `continue` silencieusement — l'utilisateur garde une
alerte qui ne se déclenchera jamais. L'UI actuelle envoie la devise de la
chambre la moins chère (donc le cas est rare via l'UI), mais l'API publique
documente `currency` optionnel « EUR par défaut » et rien n'empêche ce
silence.

**Preuves (runtime).**
- `POST /api/price-alerts` sans `currency` → `"currency": "EUR"` stocké.
- `quotePriceAlert` : `...(input.currency ? [eq(rooms.currency,
  input.currency)] : [])` ; `activeRooms.length === 0 → return null`.
- DB : la chambre la moins chère du Riad est **USD** (100,00 $US) — si
  l'alerte était créée avant/ailleurs en EUR sans autre chambre EUR, elle ne
  sonnerait pas ; aujourd'hui le Riad a aussi une chambre EUR (118,67 €), le
  cas est donc latent.

**Impact.** Confiance : l'utilisateur croit surveiller un prix, rien ne vient ;
aucun message (pas de désactivation, pas d'email « alerte non vérifiable »).
P2 (robustesse, faible probabilité).

**Solution sans régression.**
- Dans le cron (ou `quotePriceAlert`) : si aucun quote avec la devise de
  l'alerte, **retenter sans le filtre devise** et comparer le prix converti
  (mêmes taux figés `RATES_FROM_EUR` via `convertAmount` vers la devise de
  l'alerte) ; si l'alerte déclenche, envoyer l'email avec la devise d'origine
  (le prix est alors converti « indicatif » — déjà la convention plateforme).
- Ou, plus défensif : à la création (POST /api/price-alerts), **vérifier
  qu'au moins une chambre active existe dans la devise fournie** ; sinon 400
  explicite (« aucune offre en EUR pour ce bien ; choisissez USD ») — additif,
  cas existants inchangés (l'UI actuelle envoie toujours une devise valide).

### 8. Toasts : `useToast` monté globalement mais **jamais utilisé** ; gestions d'erreurs hétérogènes

**Problème.** `src/app/layout.tsx` l. 94 monte le provider `Toast` (et des
composants `Toaster`), mais **aucun composant n'appelle `useToast`**
(`grep -rn "useToast" src --include=*.tsx` → uniquement
`components/ui/toast.tsx` + layout). Les formulaires (login, inscription,
promo, avis, alertes, profil…) gèrent l'erreur chacun à sa manière (state
local, `confirm()`, message inline). Résultat : feedback incohérent,
infrastructure toast inerte (bundle + DOM inutiles).

**Preuves (runtime/grep).**
- `src/app/layout.tsx:94` : `<ToastProvider>` ; `grep useToast` : 0 appelant.
- Exemples de disparités : `promo-code-input` (message inline),
  `price-alert-button` (statut local + setTimeout 1,5 s), `contact-host-button`
  (erreur sous le bouton), `booking-row-actions` (erreur dans la ligne).

**Impact.** P2/UX : l'utilisateur ne reçoit pas de retours cohérents,
notamment après mutation réussie (un « enregistré ✓ » apparaît parfois
1,5 s puis disparaît). 

**Solution sans régression.**
- Brancher `useToast` dans les actions **mutation** existantes (additif) :
  `promo-code-input` (succès/échec), `price-alert-button` (remplacer le
  message par toast + ombre d'états), `wishlist toggle`, `review-form`,
  `profile-form` (succès), `promotion-form`, `rate-plans-section`,
  `availability-calendar` (succès de sauvegarde).
- Garder les messages inline pour les erreurs de validation champ par champ ;
  le toast est pour les confirmations/échecs globaux. Aucun test existant à
  casser (composant déjà testé ? ajouter un test « le toast apparaît à la
  soumission réussie »).

---

## ⚪ P3 — Findings UX / polish

### 9. Montants sans devise ou devises dures restantes
- `src/components/rate-plans-section.tsx` l. 115 : aperçu
  `« ${base.toFixed(2)} → ${preview.toFixed(2)} par nuit »` **sans devise**
  (la chambre peut être USD/XAF/MAD). Solution : `formatPrice(base,
  roomCurrency)` / `formatPrice(preview, roomCurrency)` — la devise est déjà
  disponible via `room.currency` dans la page parente.
- `src/components/price-alerts-section.tsx` l. ~116 : `parseFloat(a.maxPrice)
  .toFixed(2) + " " + a.currency` — correct, mais 2 décimales pour une devise
  zéro-décimale (XAF affiche « 50.00 XAF »). Solution : `formatMoney(…,
  a.currency)` (gère l'arrondi Intl).
- `src/components/promotion-form.tsx` l. 117/137/151 : libellés « (€) » durs
  pour un montant fixe / seuils libellés EUR. Solution : remplacer par
  « (EUR — devise de facturation) » + note « converti au taux plateforme
  vers la devise de la chambre » (déjà implémenté dans le serveur, T-153 B) ;
  ajouter la devise de la chambre dans l'UI quand le plan est affiché.

### 10. Devises zéro-décimales (XAF) : montants PSP et affichage
- `src/lib/payment-intents.ts` l. 47 et `src/lib/payment-events.ts` l. 50 :
  `amount: Math.round(total * 100)` **inconditionnel**. Stripe traite XAF/XOF
  comme **zéro-décimal** (liste officielle : BIF, CLP, DJF, GNF, JPY, KMF,
  KRW, MGA, PYG, RWF, VND, VUV, XAF, XOF, XPF) : un Pipeline XAF 100 000
  deviendrait un débit **10 000 000 XAF** (×100). Le mock masque le problème
  en dev ; `new-room-form` propose XAF → scénario atteignable en prod.
  (Source : [stripe-java issue #874 — liste zéro-décimal](https://github.com/stripe/stripe-java/issues/874).)
- Solution additive sans régression : helper `toMinorUnits(amount, currency)`
  (`ZERO_DECIMAL_CURRENCIES`) utilisé par `payment-intents.ts` +
  `payment-events.ts` (EUR/USD/GBP/MAD → ×100 comme aujourd'hui ; XAF → x1) +
  tests unitaires. **Pas de changement d'API publique ni de schéma.**
  (Classé P3 car nécessite Stripe réel + chambre XAF ; mais à traiter avec
  P1 si un passage en prod XAF est proche.)
- `src/lib/i18n.ts` `formatMoney` : `maximumFractionDigits: 2` → pour XAF,
  Intl affiche déjà 0 décimale si la devise le permet ? Non — le flag force
  2. Solution : laisser `maximumFractionDigits` par devise (Intl natif) ou
  `0` pour zéro-décimal.

### 11. Dark mode : couverture partielle + toggle absent du header mobile dashboard
- `src/app/globals.css` l. 26-34 : **13 règles `.dark … !important`**
  (body, bg-white, bg-gray-50/100, text-gray-900/700) seulement. Les
  composants custom (`bg-[#1B3A6B]`, `text-[#F5A623]`, cartes avec bordures,
  tableaux, badges) ne sont pas couverts → un thème sombre mi-couvert,
  contrastes hétérogènes.
- `DarkModeToggle` n'est monté que dans `src/components/layout/header.tsx`
  l. 73 ; le header du dashboard mobile
  (`src/app/dashboard/layout.tsx` / `dashboard-mobile-header`) n'en a pas →
  impossible d'activer le sombre depuis le dashboard mobile.
- Solution : étendre la palette via les variantes `dark:` (le
  `@custom-variant dark` est déjà déclaré l. 3) au fil des écrans ; ajouter le
  `<DarkModeToggle />` existant dans le dashboard-mobile-header. Additif, la
  classe `.dark` et le localStorage (déjà en place) restent le contrat.

### 12. Calendrier d'inventaire : valeurs « par défaut » non persistées et pas d'application en masse
- `src/components/availability-calendar.tsx` : le `save()` n'envoie que les
  jours présents dans l'état (`days[date]` non vide = jours **édités**) ;
  l'utilisateur voit pourtant une grille pleine (« Stock max quantity »,
  « — », « 1 ») qui suggère des valeurs réelles. `room_availability` est
  vide en DB (0 ligne) : un hôte qui ouvre le calendrier et clique
  « Enregistrer » sans rien modifier obtient « ✓ » sans écriture.
- Solution : (a) libellé explicite « vides = valeurs par défaut de la chambre »
  + (b) bouton « Appliquer à la plage » (batch PUT du même `days` complet,
  API existante) ; (c) éventuellement persister une ligne par jour au premier
  enregistrement (choix produit, à confirmer).

### 13. Inventaire amenities dupliqué et incomplet (3 listes, 5/12/12 vs 27 valeurs en base)
- `properties/new` et `properties/[id]` : liste locale de **12** amenities ;
  la recherche n'expose que **5** (wifi, parking, pool, spa, restaurant,
  `recherche/page.tsx` l. 275). La base contient **27** valeurs distinctes
  (balcony, bbq, beach, breakfast, city_view, countryside_view, kids_club,
  kitchen, rooftop, sea_view, terrace, traditional_hammam, washing_machine,
  water_sports…).
- Runtime : `?amenity=kitchen` filtre correctement (Appartement Montmartre)
  mais **aucun contrôle UI ne permet de choisir** ce filtre ; les biens avec
  `breakfast`/`kitchen`/`sea_view` ne sont pas restaurables via le formulaire
  hôte.
- Solution : extraire une **source unique** `src/lib/amenities.ts`
  (id + libellés fr/en) consommée par les 3 pages ; compléter la liste avec
  les 15 valeurs manquantes ; exposer dans la recherche soit toutes les
  valeurs, soit un multi-select (même contrat `?amenity=` actuel, une valeur
  par requête — additif).

### 14. Help center : articles statiques avec des faits à faire vivre
- `src/components/help-center.tsx` : article « Modifier mes dates » dit
  « la modification directe n'est pas encore proposée » (exact), mais
  « Une réservation Stripe est confirmée seulement après réponse du
  prestataire » — dans ce projet la confirmation est **immédiate en mode
  démo** (mock) et le webhook Stripe ne « répond » pas à une demande. Phrase
  à ajuster pour refléter le mode de paiement réel (« en production, la
  confirmation suit le statut du paiement »). P3 (documentation UI).

---

## ✅ Verdier & priorisation

| # | Priorité | Écart | Correctif sans régression | Effort |
|---|----------|-------|---------------------------|--------|
| 1 | **P1** | Recherche : prix jamais affiché (sous-requêtes corrélées en SELECT, rendu Drizzle `"id"` non qualifié) | requête annexe 2 temps (min par propriété, taux RATES_FROM_EUR) + tests | S |
| 2 | **P1** | Recherche : filtre prix min sémantiquement faux (∃ chambre ≥ min au lieu de min ≥ min) | appliquer les bornes au **min** calculé (même correction que #1) | S |
| 3 | **P1** | Cashback « Terminer le séjour » : conversion devise absente du caller PUT (T-153 C incomplet) | `calculateLoyaltyAward(..., lockedBooking.currency ?? "EUR")` + tests route | XS |
| 4 | P2 | Aperçu total ≠ facturé (TVA `0.1` dur, BestRewards invisible) | exposer `taxRate` + `bestrewardsDiscountPercent` (GET properties additive) ou récap serveur ; ligne BestRewards | M |
| 5 | P2 | « Annulation gratuite » en dur vs politique réelle | libellés dérivés de `property.cancellationPolicy` (donnée déjà chargée) | XS |
| 6 | P2 | Favoris add-only / liste[0] / aucune suppression unitaire | prop `alreadySaved` + toggle (DELETE existant) + bouton retirer favoris | M |
| 7 | P2 | Alerte prix morte si devise sans chambre | fallback sans filtre devise avec conversion, ou 400 explicite au POST | S |
| 8 | P2 | Toasts jamais utilisés, feedback hétérogène | brancher `useToast` sur les mutations (additif) | M |
| 9-14 | P3 | Devises d'affichage, XAF zéro-décimal Stripe, dark mode partiel, calendrier, amenities, help center | voir fiches | S–M |

**Recommandation de séquence d'implémentation (si l'utilisateur valide) :**
1. T-154a : P1 1+2 (recherche, un seul chantier + tests) ;
2. T-154b : P1 3 (1 ligne + tests) ;
3. T-154c : P2 5, 6, 7 (petits chantiers indépendants) ;
4. T-154d : P2 4, 8 ;
5. P3 au fil de l'eau.

**Prérequis de vérification avant implémentation** : chaque correctif doit
maintenir (a) les 152 statuts pages et 120 statuts API actuels, (b) les cas
EUR existants identiques (tests unitaires + smoke), (c) aucune migration de
schéma, (d) aucun changement de contrat d'API public (ajouts optionnels
uniquement). Aucun code n'a été modifié lors de cet audit.

---

## Annexe — Contrats vérifiés sains (règles de droit)

- `GET /api/rooms/{id}/availability` & `/rate-plans` : anon 401, customer
  403 (non propriétaire), host/admin 200.
- `GET /api/dashboard/billing/export` : anon/customer 403, host/admin 200.
- `PUT /api/bookings/{id}` cancellation : anon 401, host 403 (non
  propriétaire), owner/admin OK ; devis `GET …/cancellation` owner/admin 200.
- `GET /api/bookings/{id}/invoice` : anon 401, owner/host/admin 200.
- `/api/admin/*` : 403 hors admin ; `/api/users/me` : 405 GET (PATCH/DELETE
  seulement — front utilise `/api/auth/me`) ; routes réservation/messages/c/
  promote : 405 sur GET (POST/PUT-only).
- `/api/reviews` GET anon 200 ; `helpful` POST-only ; `moderate` PATCH-only ;
  `reply` POST-only.
- Scripts de preuves conservés dans `.data/a26/` ; aucun artefact de test
  laissé en DB (réservation, conversation, alerte et item favori créés pour
  les parcours E2E ont été supprimés ; `bookings` = 31 lignes, `conversations`
  = 0, `messages` = 0 — état initial restauré).
