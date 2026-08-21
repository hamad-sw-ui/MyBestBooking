# 🐞 Bugs et bizarreries connus

Registre libre — chaque entrée est une observation. Ajoutez une entrée quand
vous en trouvez un, cochez-la quand c'est réglé, supprimez-la si elle n'a
plus de sens.

Aucun outil ni format imposé : juste garder la trace pour la personne
suivante.

## Ouverts

_Aucun bug critique ouvert._ Le seul point restant est **BUG-003
(paiement non implémenté)** qui a été **déplacé dans
`KNOWN_LIMITATIONS.md`** en attendant qu'un fournisseur de paiement
(Stripe test key, etc.) soit disponible dans l'environnement.

## Corrigés

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
