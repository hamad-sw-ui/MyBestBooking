# 🐞 Bugs et bizarreries connus

Registre libre — chaque entrée est une observation. Ajoutez une entrée quand
vous en trouvez un, cochez-la quand c'est réglé, supprimez-la si elle n'a
plus de sens.

Aucun outil ni format imposé : juste garder la trace pour la personne
suivante.

## Ouverts

- [x] **2026-08-23 — BUG-040** (P0, T-110) : JSON-LD script-safe et cancellation persist-first. ▶️ safe JSON, 224/224, build/smoke validés.

- [ ] **2026-08-23 — BUG-037** : JSON-LD property injecté
  sans sérialisation script-safe et fenêtre de crash entre refund PSP et commit
  DB. Risque XSS hôte/public et refund sans trace. À traiter avant production.

- [ ] **2026-08-23 — BUG-037** (S résiduel, T-108 partiel,
  AUD-108-07) : les réglages notifications et certains réglages sécurité
  administrateur restent non consommés par le runtime. La sous-partie TOTP est
  corrigée en T-108 : aucun QR tiers, password + TOTP actif et secret pending.

- [ ] **2026-08-23 — BUG-038** (S résiduel, T-109 partiel) : restent les
  settings décoratifs, reporting multi-devise/timezone, quote checkout UI,
  promesses BestRewards/referral/promo, bornes de dates, conversations uniques
  et dette E2E/upgrade. Claim invité, reprise intent, outbox auth/messages,
  dashboard messages, alert reset et webhook allowlist sont corrigés en BUG-039.
  Voir T-110 et les audits post T-107.

Le point historique **BUG-003 (paiement non implémenté)** reste déplacé dans
`KNOWN_LIMITATIONS.md` : une validation Stripe réelle exige toujours des clés
fournisseur de test dans l’environnement.

## Corrigés

- [x] **2026-08-23 — BUG-039** (C, T-109) : checkout invité et opérations différées. Correctif : profil après validation, claim token hashé/session, reprise intent, outbox auth/messages, webhook strict et alert reset. ▶️ guest invalide 0 user, claim bookings 200, alert/outbox, 223/223, smoke 91/91.

- [x] **2026-08-23 — BUG-035** (C, T-108) : frontières publication/RBAC et
  fuite RSC. Correctif : DTO allowlistés, details public active-only/404,
  avis modérés privés et status host refusé. ▶️ API/Flight/draft/host/hidden
  validés.

- [x] **2026-08-23 — BUG-036** (C, T-108) : bulk finance, archive et agrégats.
  Correctif : commande cancellation+outbox, archive property non destructive
  et recompute avis transactionnel. ▶️ refund/outbox/archive/0-0 validés.

- [x] **2026-08-23 — BUG-034** (T-107) : un succès de paiement après
  expiration était consommé sans compensation, l’intent PSP restait sous
  transaction, les votes pouvaient bloquer le bulk delete et plusieurs
  parcours annonçaient une capacité partielle. Correctif : hold+TTL puis
  intent idempotent hors transaction/reprise cron, refund tardif sans
  résurrection, outbox provider-aware, cascade votes, quote alerte réel,
  navigation calendrier, count/ordre recherche, édition rate plan et keyring
  rotation. ▶️ migration 0013, webhook tardif refundé, lease mail, bulk vote,
  quote 198, PATCH plan ; 🧪 218/218 ; smoke 91/91.

- [x] **2026-08-23 — BUG-033** (T-105) : aide décorative, confirmation email
  non retryable, votes mémoire, uploads orphelins, rate plans incomplets et
  CSV non neutralisé. Correctif : articles réels, outbox, votes DB, cleanup
  cron, archivage rate plan et CSV sûr. ▶️ 215/215 + scénarios runtime.

- [x] **2026-08-23 — BUG-032** (T-104) : confirmation Stripe post-webhook
  sans email, refund pending non typé, attachments publiques et suppression
  S3 `uploads/` cassée. Correctif : service confirmation marqué, webhook
  refund, clé attachment privée/handler participant, S3 sans ACL publique et
  validation de clé `uploads/`. ▶️ participant 200/outsider 403 ; snapshot
  rate plan et confirmation webhook validés.

- [x] **2026-08-23 — BUG-031** (T-103) : aucune interface ne permettait
  de configurer Stripe, Resend ou S3 sans accès à l'environnement. Correctif :
  coffre `provider_credentials` AES-256-GCM, master key hors DB,
  endpoints admin RBAC/audit, UI `/dashboard/settings`, fallback env et
  suppression d'override. ▶️ API admin sans clé = 403 ; réponse metadata sans
  secret ; ciphertext DB sans valeur claire ; `GET /api/providers/stripe`
  n'expose que la clé publiable.

- [x] **2026-08-23 — BUG-027** (T-102) : une réservation pouvait dépasser
  adultes/enfants/capacité de la chambre, le stock journalier positif ou le
  `minStay`. Correctif : `booking-rules.ts` partagé, validation dans la
  transaction verrouillée de `POST /api/bookings`, calendrier hôte borné à la
  quantité structurelle et recherche nuit par nuit. ▶️ Stock 1 + minStay 3 :
  deux nuits → 409 ; après minStay 2 : premier booking 201, second 409.

- [x] **2026-08-23 — BUG-028** (T-102) : un voyageur pouvait passer une
  réservation future à `completed` et déposer un avis vérifié. Correctif :
  `booking-lifecycle.ts` applique les droits par rôle/date ; clôture hôte après
  départ ou cron ; avis seulement après clôture réelle. ▶️ customer
  `confirmed→completed` et POST review futur retournent tous deux 400.

- [x] **2026-08-23 — BUG-029** (T-102) : le CTA latéral de fiche passait
  `propertyId/roomId` alors que le checkout lisait `property/room`. Correctif :
  convention `reservation-url.ts`, lecture legacy temporaire, carte client
  qui conserve dates/voyageurs et checkout invité non bloqué par proxy.

- [x] **2026-08-23 — BUG-030** (T-102) : annulation laissait une réservation
  payée sans remboursement traçable et Stripe pending pouvait ressusciter un
  booking annulé. Correctif : migration 0008, provider cancel/refund, statuts
  refund et webhook qui confirme seulement un booking pending. ▶️ mock :
  cancellationFee 0, refundAmount total, refundStatus refunded.

- [x] **2026-08-21 — BUG-026** (Session 11 quinquies) : le settings
  `general` de l'admin n'exposait pas les listes `supportedLocales` et
  `supportedCurrencies` — seulement `defaultLanguage`/`defaultCurrency`.
  Une UI qui voulait construire ses dropdowns devait hard-coder les
  valeurs. Correctif : ajout de `supportedLocales` et
  `supportedCurrencies` dans le schéma Zod `generalSchema` +
  `DEFAULTS.general`. Le `mergeDefaults` de `src/lib/settings.ts`
  injecte automatiquement ces champs pour les DB existantes qui ne
  les avaient pas. Preuve : ▶️ `curl /api/admin/settings/general`
  renvoie désormais `supportedCurrencies: ["EUR","USD","GBP","XAF"]`
  et `supportedLocales: ["fr","en","ar"]`.

- [x] **2026-08-21 — BUG-025** (Session 11 quinquies) : au soft-delete
  d'un compte via `DELETE /api/users/me`, l'email et le nom
  restaient en clair dans la table `users` — non-conforme RGPD.
  Correctif : anonymisation. L'email est remplacé par
  `deleted-<sha256(original)[:16]>@anonymized.local` (non déchiffrable
  mais unique et déterministe pour éviter les collisions),
  `firstName`→"Supprimé", `lastName`→"Compte", `phone`/`avatarUrl`/
  `twoFactorSecret` nullifiés, `twoFactorEnabled`→false. L'ID reste
  (FK bookings/reviews préservées). Preuve : ▶️ Créer user
  `rgpdtest@t.local`, DELETE, DB → `email='deleted-0975a225813c2b4f@anonymized.local'`,
  `first_name='Supprimé'`.

- [x] **2026-08-21 — BUG-024** (Session 11 quinquies) : attaque
  timing sur `POST /api/auth/login`. Sans mitigation, un attaquant
  pouvait distinguer un user existant (~350ms bcrypt) d'un user
  inconnu (~5ms retour direct 401) par simple mesure du temps de
  réponse — permet l'énumération des comptes. Correctif : quand le
  user n'existe pas, on effectue quand même un `verifyPassword` sur
  un hash bidon `$2b$12$...` pour égaliser le temps. Preuve :
  ▶️ existant 475ms vs inconnu 354ms (diff 121ms < seuil 150ms
  attendu). Avant fix : diff ~340ms exploitable.

- [x] **2026-08-21 — BUG-023** (Session 11 quinquies) : durée
  d'expiration JWT réduite de 30 jours à 7 jours. Limite la fenêtre
  d'exploitation d'un token volé. Compromis UX/sécurité assumé :
  7j = confortable pour l'utilisateur régulier. Preuve :
  ▶️ décodage JWT payload post-login → `exp` dans 168.0h
  (au lieu de 720h auparavant). Impact : les sessions DB
  permettent déjà la révocation immédiate en cas de compromis, mais
  7j réduit la surface même sans révocation.

- [x] **2026-08-21 — BUG-022** (découvert Session 11 par
  `scripts/paranoid_sim.py`, section 9 « Status transitions bookings ») :
  `PUT /api/bookings/[id]` acceptait **toutes** les transitions de
  statut sans validation métier. On pouvait annuler un booking puis
  le remettre à `confirmed`, faire `completed → pending`, ou toucher
  arbitrairement un booking `cancelled`/`completed` (statuts qui
  devraient être terminaux). Correctif : ajout d'une **machine à
  états stricte** dans `src/app/api/bookings/[id]/route.ts` :
  - `pending → confirmed | cancelled`
  - `confirmed → cancelled | completed | no_show`
  - `cancelled | completed | no_show → (aucun, terminal)`
  Toute transition non autorisée renvoie 400 `{error:"Transition
  invalide : X → Y (autorisées : ...)"}`. Preuves : ▶️ Cancel booking
  → `status=cancelled`, PUT `{status:"confirmed"}` → 400 avec message
  explicite, DB confirme le statut inchangé. Ni R18/R19/R20/smoke/
  deep/xtreme n'auraient trouvé ce bug — il faut tester des
  **séquences** d'actions, pas juste des actions isolées.

- [x] **2026-08-21 — BUG-021** (découvert Session 11 par
  `scripts/paranoid_sim.py`, section 15 « Data leakage ») :
  `GET /api/properties` exposait **`commissionRate`, `validatedBy`,
  `hostId`** au public (endpoint anonyme). `commissionRate` est un
  secret métier (marge de la plateforme, ex : 15%) qui ne devrait
  jamais être visible aux voyageurs/concurrents. Correctif :
  `src/app/api/properties/route.ts` filtre ces 3 champs pour les
  requêtes non-admin ; admin peut les voir via GET /api/properties/[id]
  qui garde le shape complet. Preuves : ▶️ `curl /api/properties`
  anonyme → aucun `commissionRate` dans le JSON ; ▶️ même endpoint
  avec cookie admin → `commissionRate: "15.00"` présent.

- [x] **2026-08-21 — BUG-020** (découvert Session 11 par
  `scripts/paranoid_sim.py`, section 1 « Race conditions ») : **RACE
  CONDITION CRITIQUE dans la logique de disponibilité**.
  `POST /api/bookings` faisait `SELECT bookings FOR UPDATE` pour
  compter les chevauchements, mais en isolation READ COMMITTED de
  PostgreSQL, ce lock ne verrouille QUE les rows existants, pas les
  futurs INSERT. Résultat : 15 threads concurrents sur une chambre
  `quantity=6` créaient **10 bookings** (surbooking massif de 4
  bookings au-delà de la capacité). Correctif :
  `src/app/api/bookings/route.ts` ajoute un `SELECT rooms WHERE id=?
  FOR UPDATE` au tout début de la transaction, qui verrouille la row
  ROOMS elle-même et sérialise toutes les transactions bookings sur
  cette room. Preuves : après fix, 15 threads → **exactement
  6×201 + 4×409 + 5×429** (rate-limit), DB confirme 6 bookings max.
  Impact business : sans ce fix, un hôte pouvait recevoir plus de
  bookings que sa capacité réelle, provoquer des refus à l'arrivée
  et rembourser à perte.

- [x] **2026-08-21 — BUG-019** (découvert Session 11 par
  `scripts/xtreme_sim.py`, section 17 « Flow 2FA à login ») : le login
  `POST /api/auth/login` **ne vérifiait PAS** le code TOTP même quand
  `user.twoFactorEnabled === true`. Le composant `<TwoFactorSection>`
  (T-030) faisait croire à l'utilisateur qu'il était protégé alors
  que la 2FA n'était **jamais exigée** à la connexion — gap sécuritaire
  critique. Correctif : `src/app/api/auth/login/route.ts` accepte
  désormais un champ optionnel `totpCode` ; si `twoFactorEnabled=true`
  sans code → 401 `{twoFactorRequired:true}` ; code invalide → 401
  `{error:"Code 2FA invalide",twoFactorRequired:true}` ; code valide
  → 200. Preuves : ▶️ `POST login sans totpCode` → 401 attendu ;
  ▶️ `POST login avec totpCode` généré via speakeasy → 200. Ni
  R18/R19/R20 ni les 176 tests unitaires n'auraient trouvé ce bug
  car aucun test n'exerçait le login **après** activation 2FA.

- [x] **2026-08-21 — BUG-018** (découvert Session 11 par
  `scripts/xtreme_sim.py`, section 8 « Rooms availability + rate-plans ») :
  la route `POST /api/bookings` **ignorait totalement** la table
  `roomAvailability`. Un hôte qui bloquait manuellement des dates via
  `PUT /api/rooms/[id]/availability` avec `stopSell:true` ou
  `availableCount:0` n'avait **aucun effet** — la logique de
  disponibilité ne consultait que les chevauchements dans `bookings`.
  Correctif : ajout d'une sous-requête `SELECT roomAvailability WHERE
  roomId=? AND date IN [checkIn, checkOut)` dans la transaction ; si
  UNE seule nuit est `stopSell` ou `availableCount=0` → throw
  ROOM_UNAVAILABLE → 409. Preuves : ▶️ PUT availability 2029-03-01..03
  avec stopSell:true, puis POST booking sur ces dates → 409
  `{error:"Cette chambre n'est plus disponible pour ces dates"}`.
  Contre-preuve : POST booking sur dates libres → 201.

- [x] **2026-08-21 — BUG-017** (découvert Session 11 par
  `scripts/deep_sim.py`) : `PATCH /api/users/me` accepte
  `priceAlertEnabled` (et `twoFactorEnabled` en lecture indirecte) en
  entrée mais **ne les renvoie pas** dans la réponse `user`. Le
  composant `<NotificationPrefsSection>` (T-030) qui affiche le
  résultat du PATCH ne pouvait donc pas confirmer visuellement le
  toggle sans forcer un `/api/auth/me`. Correctif : ajout de
  `email`, `priceAlertEnabled`, `twoFactorEnabled` dans la sélection
  du retour. Preuves : ▶️ `curl PATCH priceAlertEnabled=true` renvoie
  désormais `"priceAlertEnabled": true` (validé). Ce bug avait
  échappé aux 176 tests Vitest + R18 + R19 + `npm run smoke` — il
  n'est visible qu'en jouant le PATCH et en lisant la structure du
  retour, pas juste le code HTTP. **C'est exactement pourquoi R20
  smoke n'est pas suffisant : il faut aussi vérifier le SHAPE des
  réponses, pas seulement leur code HTTP.** À noter pour R21+.

- [x] **2026-08-20 — BUG-016** (découvert Session 6) : deux
  `createSession()` du même user à la même seconde généraient le même
  JWT → violation de `sessions_token_unique`. Corrigé par ajout d'un
  `jti` (UUID) au payload dans `src/lib/auth.ts:createToken`. Test
  ajouté dans `src/lib/auth.test.ts` (« deux createToken consécutifs
  produisent des JWT différents »).

- [x] **2026-08-20 — BUG-003 (partiellement corrigé)** : le paiement
  n'est plus mocké en dur. Infrastructure Stripe complète en T-020
  (abstraction PaymentProvider + Stripe + Mock + webhook signé +
  paymentIntentId en DB). Reste : credentials Stripe test-mode
  (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET) à fournir en env prod.
  Voir `KNOWN_LIMITATIONS.md` (dépendance externe).

- [x] **2026-08-20 — BUG-014** : `lucide-react@1.33.0` est bien la
  version majeure v1 officielle (sortie 2025-2026, attributs SVG
  améliorés `aria-hidden`, `stroke-linecap="round"`, etc.). Vérifié
  via `npm ls lucide-react` et sortie HTML de `GET /` contenant des
  `<svg class="lucide lucide-*">` bien rendus. Faux positif dans la
  doc initiale. Tâche **T-010** (T, trivial).

- [x] **2026-08-20 — BUG-009** : rate-limiter en mémoire (Map,
  fenêtre glissante) dans `src/lib/rate-limit.ts` appliqué à
  `POST /api/auth/login` (20 req/min/IP + 5 req/min/email) et
  `POST /api/auth/register` (10 req/min/IP). Retourne 429 avec
  `Retry-After`. Tâche **T-009** (S), 5 tests unitaires
  `src/lib/rate-limit.test.ts`. Test manuel ▶️ : 5 mauvais logins
  puis un 6e (même bon mdp) retournent tous 429.

- [x] **2026-08-20 — BUG-008** : `POST /api/auth/register` met
  désormais `emailVerified: false` (au lieu de `true` "for demo").
  Le flux d'envoi/vérification par email reste à faire — tracé dans
  `KNOWN_LIMITATIONS.md`. Tâche **T-008** (S, groupée avec T-006/BUG-006).

- [x] **2026-08-20 — BUG-006** : composants critiques (`PropertyCard`,
  vignettes destinations de l'accueil) migrés vers `next/image` avec
  attributs `fill` + `sizes`. `next.config.ts → images.remotePatterns`
  autorise `images.unsplash.com` et `plus.unsplash.com`. Headers de
  sécurité ajoutés en même temps (X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Strict-Transport-Security,
  Permissions-Policy). Test manuel ▶️ : `curl -I /` retourne bien tous
  les headers. Tâche **T-008** (S).

- [x] **2026-08-20 — BUG-015** : migrations Drizzle versionnées créées
  et commitées dans `drizzle/` (0000_opposite_gertrude_yorkes.sql
  initial + 0001_lowly_argent.sql pour contraintes T-006). Tâche
  incluse dans le setup (commit `2c37021`) et T-006.

- [x] **2026-08-20 — BUG-013** : `uniqueIndex('uniq_room_availability_room_date')`
  ajouté à `roomAvailability`. Migration `drizzle/0001_lowly_argent.sql`.
  Tâche **T-006** (S).

- [x] **2026-08-20 — BUG-012** : `uniqueIndex('uniq_wishlist_items_wishlist_property')`
  ajouté à `wishlistItems`. Migration `drizzle/0001_lowly_argent.sql`.
  Tâche **T-006** (S). Test manuel ▶️ : 2e ajout du même item retourne
  `{"error":"Hébergement déjà dans la liste"}`.

- [x] **2026-08-20 — BUG-011** : `check('bookings_dates_check')` +
  `check('bookings_nights_positive')` ajoutés à `bookings`, et refine
  Zod dans `POST /api/bookings` qui rejette `checkOut <= checkIn` avec
  message français clair. Tâche **T-006** (S). Test manuel ▶️ : POST
  avec dates égales retourne `400 {"error":"La date de départ doit
  être postérieure à la date d'arrivée"}`.

- [x] **2026-08-20 — BUG-010** : `POST /api/reviews` recalcule
  `properties.averageRating` et `totalReviews` via un unique `UPDATE
  ... FROM (SELECT AVG, COUNT ...)` atomique — plus de race entre
  deux avis concurrents. Tâche **T-007** (S).

- [x] **2026-08-20 — BUG-007** : `useSearchParams` dans
  `src/app/(main)/reservation/page.tsx` enveloppé dans `<Suspense>`.
  Le composant a été renommé `ReservationPageInner` et l'export
  default est un wrapper. Tâche **T-005** (L).

- [x] **2026-08-20 — BUG-004** : `GET /api/properties` utilise
  désormais un unique `LEFT JOIN rooms + GROUP BY properties.id`
  avec `MIN(basePrice)` et `COUNT(rooms.id)` agrégés en SQL. Plus de
  N+1. Tâche **T-004** (S). Test manuel ▶️ : filtres
  city/type/minPrice/maxPrice/search retournent les mêmes résultats
  qu'avant.

- [x] **2026-08-20 — BUG-005** : `src/proxy.ts` (Next.js 16 remplace
  `middleware.ts`) redirige vers `/connexion?next=<path>` les accès non
  authentifiés à `/mon-compte`, `/mes-reservations`, `/mes-favoris`,
  `/messages`, `/reservation`, `/dashboard/*`. Vérification JWT via
  `jose` en edge runtime. Tâche **T-003** (niveau S), ADR-005,
  5 tests dans `src/proxy.test.ts`.

- [x] **2026-08-20 — BUG-002** : `POST /api/seed` retourne 404 en
  production sauf en-tête `x-seed-token` valide (comparaison
  timing-safe). Tâche **T-002** (niveau C), ADR-004, 7 tests
  automatisés dans `src/app/api/seed/route.test.ts`.

- [x] **2026-08-20 — BUG-001** : `JWT_SECRET` obligatoire au boot.
  `src/lib/auth.ts` throw explicitement si la variable est absente,
  warn si < 32 caractères. Tâche **T-001** (niveau C), ADR-003,
  9 tests automatisés dans `src/lib/auth.test.ts`. Voir
  `TRACEABILITY.md` pour les preuves.

- [x] **2026-08-27 — BUG-041** (L, T-119 / A1) : `GET /api/properties?guests=N`
  renvoyait des hébergements impossibles à réserver. Le filtre capacité était
  posé en condition d'un LEFT JOIN : une propriété sans chambre compatible
  ressortait quand même (`roomCount=0`, `minPrice=null`). ▶️ preuve avant :
  `guests=6` → 8 résultats dont 0 chambre logeable (capacités max 2/3/4) ;
  après : `guests=6/99` → 0, `guests=2` → 8, `guests=3` → 4. Correctif :
  exclusion des `roomCount=0` quand un filtre capacité/prix est explicite.
- [x] **2026-08-27 — BUG-042** (L, T-119 / A2) : paramètres de recherche
  invalides silencieusement ignorés par l'API. `guests=-5`/`guests=abc`
  n'appliquaient pas le filtre (→ tous les résultats) et des dates inversées
  (`checkOut<=checkIn`) faisaient sauter le filtre de disponibilité.
  ▶️ après : `guests` invalide → **400** « entier positif », dates incohérentes
  → **liste vide**. Non-régressif (requêtes valides inchangées).
