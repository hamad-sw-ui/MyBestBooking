# 🐞 Bugs et bizarreries connus

Registre libre — chaque entrée est une observation. Ajoutez une entrée quand
vous en trouvez un, cochez-la quand c'est réglé, supprimez-la si elle n'a
plus de sens.

Aucun outil ni format imposé : juste garder la trace pour la personne
suivante.

## Ouverts

- [ ] **BUG-003 — Paiement non implémenté**. `POST /api/bookings` force
  `paymentStatus: 'paid'` et `status: 'confirmed'` sans intégration
  paiement réelle. Toute réservation est gratuite aujourd'hui.

- [ ] **BUG-006 — `<img>` HTML natif** partout au lieu de `next/image`. Pas
  d'optimisation, pas de lazy-loading géré, LCP dégradé. Suppose d'ajouter
  `images.remotePatterns` dans `next.config.ts` (unsplash.com, etc.).

- [ ] **BUG-008 — `emailVerified: true` d'office à l'inscription**
  (`src/app/api/auth/register/route.ts`, commentaire `// For demo purposes`).
  À réactiver via un vrai flux (email de confirmation) avant prod.

- [ ] **BUG-009 — Pas de rate-limiting** sur `/api/auth/login`. Brute-force
  possible. Ajouter un limiteur (par IP, par email, avec Redis ou table
  éphémère).

- [ ] **BUG-014 — `lucide-react` `1.33.0`** : version majeure suspecte (la
  stable est `0.4xx`). Vérifier avec `npm ls lucide-react` que les icônes
  s'affichent bien après un `npm install` propre.

## Corrigés

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
