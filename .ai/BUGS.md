# 🐞 Bugs et bizarreries connus

Registre libre — chaque entrée est une observation. Ajoutez une entrée quand
vous en trouvez un, cochez-la quand c'est réglé, supprimez-la si elle n'a
plus de sens.

Aucun outil ni format imposé : juste garder la trace pour la personne
suivante.

## Ouverts

- [ ] **B-001 — `JWT_SECRET` avec fallback hard-codé** (`src/lib/auth.ts:9`).
  Risque : forge de JWT admin en prod si la variable n'est pas définie.
  Fix : remplacer par un `throw` obligatoire au boot.

- [ ] **B-002 — `POST /api/seed` accessible publiquement** sans auth ni token.
  Truncate + réinsère toute la base. À protéger ou à retirer avant prod.

- [ ] **B-003 — Paiement non implémenté**. `POST /api/bookings` force
  `paymentStatus: 'paid'` et `status: 'confirmed'` sans intégration
  paiement réelle. Toute réservation est gratuite aujourd'hui.

- [ ] **B-004 — N+1 sur `GET /api/properties`**. Pour chaque property
  retournée, un `SELECT` séparé sur `rooms` pour calculer `minPrice`.
  À remplacer par un `LEFT JOIN` avec `MIN(basePrice)` groupé.

- [ ] **B-005 — Pas de `middleware.ts` de protection**. Les routes
  `/mon-compte`, `/mes-reservations`, `/mes-favoris`, `/messages` ne
  redirigent pas si l'utilisateur n'est pas connecté (le contenu se contente
  probablement d'être vide). Ajouter la garde côté layout ou middleware.

- [ ] **B-006 — `<img>` HTML natif** partout au lieu de `next/image`. Pas
  d'optimisation, pas de lazy-loading géré, LCP dégradé. Suppose d'ajouter
  `images.remotePatterns` dans `next.config.ts` (unsplash.com, etc.).

- [ ] **B-007 — `useSearchParams()` sans `<Suspense>`** dans
  `src/app/(main)/reservation/page.tsx`. Next 16 peut refuser le build.
  Envelopper le composant client dans un `<Suspense fallback={…}>`.

- [ ] **B-008 — `emailVerified: true` d'office à l'inscription**
  (`src/app/api/auth/register/route.ts`, commentaire `// For demo purposes`).
  À réactiver via un vrai flux (email de confirmation) avant prod.

- [ ] **B-009 — Pas de rate-limiting** sur `/api/auth/login`. Brute-force
  possible. Ajouter un limiteur (par IP, par email, avec Redis ou table
  éphémère).

- [ ] **B-010 — Race condition sur `properties.averageRating`**. Le calcul
  se fait à la main dans `POST /api/reviews` : deux avis simultanés peuvent
  se marcher dessus. Passer à un `UPDATE ... SET averageRating = (subquery)`
  atomique, ou à un trigger PostgreSQL, ou à un recalcul planifié.

- [ ] **B-011 — Pas de contrainte `checkIn < checkOut`** en base ni dans le
  schéma Zod de `POST /api/bookings`. Un booking `numNights = 0` ou négatif
  est théoriquement possible.

- [ ] **B-012 — Pas d'unicité `(wishlistId, propertyId)`** sur
  `wishlist_items` : un même hébergement peut être ajouté deux fois à la même
  liste.

- [ ] **B-013 — Pas d'unicité `(roomId, date)`** sur `room_availability` :
  attendue en général pour un calendrier.

- [ ] **B-014 — `lucide-react` `1.33.0`** : version majeure suspecte (la
  stable est `0.4xx`). Vérifier avec `npm ls lucide-react` que les icônes
  s'affichent bien après un `npm install` propre.

- [ ] **B-015 — Aucune migration Drizzle commitée**. `drizzle-kit push`
  seulement — impossible de rejouer proprement la construction du schéma.
  Générer les migrations et versionner un dossier `drizzle/`.

## Corrigés

Ajouter ici avec la date quand un item est réglé, exemple :

```
- [x] 2026-XX-XX — B-001 : JWT_SECRET obligatoire au boot (commit abc123).
```
