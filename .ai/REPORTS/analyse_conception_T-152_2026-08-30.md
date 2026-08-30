# Analyse de conception — T-152 (implémentation des findings A→E + G, audit n°24)

- **Date** : 2026-08-30
- **Tâche** : T-152 — implémentation sans régression des remarques de
  l'audit fonctionnel n°24 (rapport `REPORTS/audit_fonctionnel_profond24_2026-08-30.md`).
- **Niveau** : S — Structurant (voir analyse d'impact `analyse_impact_T-152_2026-08-30.md`).

## 1. Objectif

Rendre l'application conforme à ce que l'audit a identifié comme inachevé ou
mal pensé, **sans casser le fonctionnement existant** :

- **A** — un voyageur avec une réservation `pending` (checkout abandonné /
  paiement non finalisé) doit pouvoir **payer maintenant** ou **annuler** ;
- **B** — le tunnel de réservation doit afficher la **vraie devise** de la
  chambre (plus de « € » codé en dur sur une chambre USD) ;
- **C** — les totaux analytics/billing ne doivent plus additionner des
  devises différentes sans l'indiquer ;
- **D** — un sélecteur **FR/EN** dans le header, `<html lang>` dynamique,
  préférence persistée (compte connecté **et** anonyme) ;
- **E** — après dépôt d'un avis : état propre dans `/mes-reservations` et
  page `/avis/[id]` sans 400 doublon ;
- **G** — le smoke ne doit plus dépendre de la wishlist du seed.

## 2. Problème actuel (constaté dans le code)

- `BookingRowActions` : bouton Annuler seulement si `status === "confirmed"` ;
  aucun CTA payer → `resumePayment()` de `reservation/page.tsx` n'est jamais
  atteignable depuis `/mes-reservations`.
- `reservation/page.tsx` : `RoomData` sans `currency` (l.44-53), `€{...}`
  aux emplacements recap/button/confirmation (l.551/580/655/661/668/673) ;
  `GET /api/properties/[id]` renvoie pourtant les chambres complètes
  (devise incluse) et `POST /api/bookings` stocke `room.currency`.
- `dashboard/analytics/page.tsx` l.191/205/277/308 et
  `dashboard/billing/page.tsx` l.166/180/194/238 : `formatPrice(somme)`
  sans devise (EUR implicite) alors que les lignes passent bien
  `booking.currency` (billing l.287/289).
- `layout.tsx` l.58 `<html lang="fr">` figé ; header sans sélecteur de
  langue ; `getServerLocale()` existe déjà (miroir serveur T-134) mais
  n'est pas utilisé par le layout ; `PATCH /api/users/me` accepte déjà
  `language` (validé `isUiLocale`, l.20-24) ; `useDisplayPreferences`
  résout langue par `user → plateforme`, sans localStorage.
- `GET /api/bookings` ne joint pas `reviews` ; la page
  `mes-reservations/page.tsx` affiche le CTA « Laisser un avis » pour tout
  `status === "completed"`, la page `avis/[id]` ne teste que
  `isReviewEligible` (pas l'existence d'un avis) → le POST renvoie le 400
  « Vous avez déjà laissé un avis » (route reviews l.~152).
- `scripts/smoke.sh` (l.322-349) : si `WL` vide, l'assertion wishlist est
  simplement sautée.

## 3. Solutions possibles

### Solution 1 — Correctifs ciblés additifs (retenue)

Chaque finding est traité au plus près du problème, uniquement côté
affichage/UI + champs additifs API, en réutilisant les briques existantes
(`resumePayment`, `formatPrice`, `getServerLocale`, `PATCH users/me`,
`leftJoin reviews`).

- Avantages : risque minimal, diff localisé, aucun schéma/migration, toutes
  les API restent compatibles (rétro : les champs sont ajoutés, jamais
  retirés), démontrable par tests + smoke + runtime.
- Inconvénients : plusieurs fichiers touchés ; la migration i18n n'est pas
  complète (20/113 composants) mais le sélecteur devient réellement
  fonctionnel (« effet réel » vérifié) sans traduction massive.
- Complexité : M. Performance : négligeable (1 leftJoin, 1 fetch de plus
  uniquement sur `/reservation?booking=`, cache module conservé).
- Sécurité : aucune surface nouvelle (PATCH déjà gardé, RBAC conservé).
- Maintenabilité : helpers purs testables (`currency-summary`), clés
  ui-strings typées.
- Impact architecture : nul (pas de nouvelle dépendance).

### Solution 2 — Ne rien faire / documenter

- Avantages : zéro risque, EUR = cas réel actuel (seed 100 % EUR).
- Inconvénients : la fausse info monétaire et le blocage d'une reprise de
  paiement restent des défauts produits ; la promesse « langue » reste
  partielle sans sélecteur ; le 400 « doublon » demeure subi.
- Jugement : non défendable après un audit qui les classe P1/P2 et une
  demande explicite d'implémentation.

### Solution 3 — Refonte transverse (moteur multi-devises complet + i18n total)

Convertir tous les totaux via un moteur de conversion **transactionnel**
(multi-devises PSP), traduire les 113 composants, refondre la modération
d'avis.

- Avantages : résultat théoriquement « parfait ».
- Inconvénients : impact sur la logique financière (→ niveau C, débat
  obligatoire), volume de travail disproportionné pour ce qui est un
  problème d'**affichage** ; Stripe ne supportant pas le XAF (contrainte
  T-132), la conversion transactionnelle est hors périmètre produit ;
  risque de régression bien supérieur, non demandé.
- Jugement : écarté pour cette itération ; consigné comme horizon
  (`KNOWN_LIMITATIONS` : une seule devise d'affichage, conversion
  uniquement indicative).

## 4. Solution retenue (détail par finding)

### A — Pending : Payer maintenant + Annuler
1. `BookingRowActions` : nouvelle prop `paymentStatus?: string | null` ;
   si `status === "pending"` → lien **« Payer maintenant »**
   (`/reservation?booking={id}`) ; condition Annuler étendue à
   `status === "confirmed" || status === "pending"` (**aucun** changement
   backend : `PUT /api/bookings/[id]` + `cancelBooking` + devis
   d'annulation acceptent déjà `pending`, vérifié).
2. `reservation/page.tsx` : si `?booking=` est présent,
   - GET `/api/bookings/{id}` → pré-remplir property/room/dates (état
     interne `loadedPropertyId/loadedRoomId` pour réutiliser le chargement
     existant de la fiche + ratePlans + profil),
   - `setResumeBookingId(id)` puis appel auto de `resumePayment()` —
     refactoré en `resumePaymentFor(id)` pour éviter la fermeture obsolète,
   - si la résa est `confirmed` ou `cancelled` → message explicite
     (aucun POST payment), pas de boucle.
3. Garde : `resumePaymentIntentForBooking` refuse déjà les statuts
   non-pending/intent expiré (404/409 propres).

### B — Devise réelle dans /reservation
1. `RoomData.currency: string` (l'API la fournit déjà) ;
2. `formatPrice(montant, room?.currency ?? "EUR")` aux emplacements recap
   (prix unitaire, sous-total, remise, taxes, promo, wallet → **EUR**
   explicite car `walletBalance` est en EUR par construction, total final)
   et bouton « Continuer vers le paiement » + montant de confirmation
   (`confirmation.total` + devise de la chambre) ;
3. le détail « Annulation gratuite » / mentions inchangées.

### C — Totaux analytics/billing explicites
1. Nouveau helper pur `src/lib/currency-summary.ts` :
   `sumByCurrency(items)`, `topCurrency(map)`, `formatCurrencyBreakdown(map)`
   (1 devise → `formatPrice` ; n devises → liste jointe, jamais additionnées
   à l'affichage) ;
2. analytics : `currentRevenueByCurrency`, `previousRevenueByCurrency`,
   `avgBookingValueByCurrency`, chart série = devise principale avec note
   si devises mixtes, top propriétés = répartition par devise ;
   les **pourcentages d'évolution** restent calculés comme avant (simple
   comparaison de flux, étiquetés « toutes devises ») ;
3. billing : `netByCurrency` (revenue/commission suivent) sur les 3 cartes ;
   lignes de transactions déjà correctes (inchangées) ;
4. en EUR (cas réel) → rendu identique à aujourd'hui (aucune régression
   visuelle). Test unitaire du helper.

### D — Sélecteur de langue + `<html lang>` dynamique
1. Nouveau `src/components/language-selector.tsx` (client) :
   - valeur initiale = `useDisplayPreferences().language` ;
   - `<select>` FR/EN (comme profil) ; `aria-label` localisé ;
   - si connecté → `PATCH /api/users/me { language }` (attendu, erreur
     affichée sans rechargement) puis `location.reload()` ; si anonyme →
     `localStorage.setItem("mybb:ui-language", value)` puis reload ;
   - met aussi `document.documentElement.lang` immédiatement.
2. `useDisplayPreferences` : après `GET /api/auth/me`, si **aucune** langue
   utilisateur valide → lire `localStorage` (anonyme). Priorité conservée :
   utilisateur connecté > localStorage > plateforme > fr.
3. `layout.tsx` : `const locale = await getServerLocale()` ;
   `<html lang={locale}>` + script `beforeInteractive` qui, **sans**
   utilisateur connecté, applique `localStorage` avant hydratation (aucun
   FOUC ; `suppressHydrationWarning` déjà présent).
4. Clés ui-strings : `nav.language` / `account.language` (réutilisée
   `account.language`), aucun retrait.

### E — Avis : état propre
1. `GET /api/bookings` : `leftJoin(reviews, eq(reviews.bookingId, bookings.id))`
   → champ additif `review: { id, overallRating, status } | null`.
2. `mes-reservations` (RSC) : même leftJoin ; si `review` → badge/lien
   « Avis publié » (approved), « En attente de modération » (pending), sinon
   « Avis soumis » ; CTA « Laisser un avis » conservé uniquement sans avis.
3. `avis/[id]/page.tsx` : si la résa possède un avis → écran d'état
   (note, statut, lien hébergement/réservations), **pas** de formulaire ;
   l'API reste la source de vérité (aucune modification de `POST /reviews`).
4. Clés : `bookings.reviewPublished`, `bookings.reviewPending`,
   `bookings.reviewSubmitted`, `bookings.alreadyReviewed`,
   `bookings.yourRating`, `bookings.payNow`.

### G — Smoke auto-suffisant
`scripts/smoke.sh` : si `WL` vide → `POST /api/wishlists {"name":"Smoke
auto","isPublic":false}` → réutiliser l'id créé pour l'ajout d'élément ;
si l'API refuse (401/429) → assertion `ko` (visible) au lieu d'un saut
silencieux. Compteur `@assertions` recompé en fin de modification.

## 5. Risques

| Risque | Niveau | Mitigation |
|---|---|---|
| Bug d'affichage sur les montants | Faible | helper testé + EUR inchangé + smoke pages analytics/billing |
| Reprise auto déclenchée sur une résa déjà payée | Faible | garde statut (pending + paymentStatus pending) + API 409 |
| Sélecteur langue : incohérence cache client | Faible | reload après PATCH ; priorité user > localStorage > défaut ; script idempotent |
| `GET /api/bookings` plus lourd d'un LEFT JOIN | Faible | index `idx_reviews_property` ; volume faible |
| Smoke fragile | Faible | création auto wishlist + assertion visible |

## 6. Compatibilité / rétrocompatibilité

- **Aucune** signature d'API retirée ; `GET /api/bookings` ne fait
  qu'**ajouter** `review`. Anciens clients ignorants du champ : inchangés.
- Aucune migration, aucun changement de colonne, aucun format persisté.
- URL `/reservation?property=&room=` inchangée ; `?booking=` est un chemin
  **supplémentaire** (précédence sur les params legacy si présent).
- Comportement par défaut identique (langue fr, devise EUR affichée comme
  avant pour l'EUR, CTA avis identique avant dépôt).
- Sidebar/profil/header inchangés visuellement sauf ajout sélecteur.

## 7. Plan de développement (étapes validables individuellement)

1. Helper `currency-summary` + tests unitaires (C).
2. `BookingRowActions` (payer/annuler pending) + props `paymentStatus`.
3. `reservation/page.tsx` : devise (B) + reprise `?booking=` (A) + labels.
4. API `GET /api/bookings` : `leftJoin reviews` + test (E1).
5. `mes-reservations` + page avis : état avis (E2/E3) + clés ui-strings.
6. `analytics` + `billing` : totaux par devise (C2/C3).
7. Langue : `LanguageSelector`, `layout` lang dynamique, `useDisplayPreferences`
   localStorage anonyme (D).
8. Smoke : wishlist auto + assertions (G) ; recompter `@assertions`.
9. Chaîne complète : `typecheck` → `lint` → `vitest` → `smoke` → `build` →
   `ai:check` ; preuves runtime ; rapports ; docs `.ai/` ; commit + push.

## 8. Plan de retour arrière

- `git revert <sha>` unique ou `git reset --hard 99b4c7f` (T-152 = 1
  commit atomique) ; les champs additifs disparaissent sans casser les
  clients (ils ne les lisaient pas avant).
- Données : aucun changement de données possible (aucune migration) → rien
  à restaurer ; seules les créations d'avis/résas faites par les preuves
  runtime sont nettoyées en fin de session.
