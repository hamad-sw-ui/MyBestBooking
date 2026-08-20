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

- [ ] **BUG-004 — N+1 sur `GET /api/properties`**. Pour chaque property
  retournée, un `SELECT` séparé sur `rooms` pour calculer `minPrice`.
  À remplacer par un `LEFT JOIN` avec `MIN(basePrice)` groupé.

- [ ] **BUG-006 — `<img>` HTML natif** partout au lieu de `next/image`. Pas
  d'optimisation, pas de lazy-loading géré, LCP dégradé. Suppose d'ajouter
  `images.remotePatterns` dans `next.config.ts` (unsplash.com, etc.).

- [ ] **BUG-007 — `useSearchParams()` sans `<Suspense>`** dans
  `src/app/(main)/reservation/page.tsx`. Next 16 peut refuser le build.
  Envelopper le composant client dans un `<Suspense fallback={…}>`.

- [ ] **BUG-008 — `emailVerified: true` d'office à l'inscription**
  (`src/app/api/auth/register/route.ts`, commentaire `// For demo purposes`).
  À réactiver via un vrai flux (email de confirmation) avant prod.

- [ ] **BUG-009 — Pas de rate-limiting** sur `/api/auth/login`. Brute-force
  possible. Ajouter un limiteur (par IP, par email, avec Redis ou table
  éphémère).

- [ ] **BUG-010 — Race condition sur `properties.averageRating`**. Le calcul
  se fait à la main dans `POST /api/reviews` : deux avis simultanés peuvent
  se marcher dessus. Passer à un `UPDATE ... SET averageRating = (subquery)`
  atomique, ou à un trigger PostgreSQL, ou à un recalcul planifié.

- [ ] **BUG-011 — Pas de contrainte `checkIn < checkOut`** en base ni dans le
  schéma Zod de `POST /api/bookings`. Un booking `numNights = 0` ou négatif
  est théoriquement possible.

- [ ] **BUG-012 — Pas d'unicité `(wishlistId, propertyId)`** sur
  `wishlist_items` : un même hébergement peut être ajouté deux fois à la même
  liste.

- [ ] **BUG-013 — Pas d'unicité `(roomId, date)`** sur `room_availability` :
  attendue en général pour un calendrier.

- [ ] **BUG-014 — `lucide-react` `1.33.0`** : version majeure suspecte (la
  stable est `0.4xx`). Vérifier avec `npm ls lucide-react` que les icônes
  s'affichent bien après un `npm install` propre.

- [ ] **BUG-015 — Aucune migration Drizzle commitée**. `drizzle-kit push`
  seulement — impossible de rejouer proprement la construction du schéma.
  Générer les migrations et versionner un dossier `drizzle/`.

## Corrigés

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
