# 📋 Backlog

Liste d'idées et de tâches, sans ordre imposé, sans engagement. On y pioche,
on en ajoute, on en retire. Pas de statut « bloquant », pas d'ID à respecter.

Les items marqués 🔴 sont ceux qu'il faudrait faire **avant toute mise en
production réelle**. Les autres sont des améliorations.

## Sécurité

- 🔴 Remplacer le fallback `JWT_SECRET` par un `throw` au démarrage.
- 🔴 Protéger ou retirer `POST /api/seed`.
- 🔴 Intégrer un vrai fournisseur de paiement (Stripe test mode pour commencer).
- Ajouter un `middleware.ts` qui protège `/mon-compte/*`,
  `/mes-reservations/*`, `/mes-favoris/*`, `/messages/*` et `/dashboard/*`.
- Ajouter les headers de sécurité dans `next.config.ts`
  (`Strict-Transport-Security`, `X-Content-Type-Options`, CSP…).
- Rate-limiting sur `/api/auth/login` et `/api/auth/register`.
- Vérification d'email réelle (envoi d'un lien signé, retirer le
  `emailVerified: true // demo`).
- Support du 2FA (`users.twoFactorEnabled` existe déjà).

## Base de données

- Générer les migrations Drizzle et versionner le dossier `drizzle/`.
- Ajouter `UNIQUE (roomId, date)` sur `room_availability`.
- Ajouter `UNIQUE (wishlistId, propertyId)` sur `wishlist_items`.
- Ajouter une contrainte `CHECK (check_in < check_out)` sur `bookings`.
- Passer `properties.averageRating` sur un recalcul atomique (subquery ou
  trigger).
- Ajouter un index sur `bookings.checkIn`, `bookings.checkOut` pour les
  requêtes de disponibilité.

## API

- Handlers manquants :
  - `/api/promotions` (CRUD admin + validation d'un code au checkout).
  - `/api/conversations` + `/api/messages` (aujourd'hui la page `messages`
    n'a pas de source d'API dédiée).
  - `/api/rate-plans` + `/api/room-availability` (calendrier hôte).
- Corriger le N+1 dans `GET /api/properties` (JOIN + `MIN(basePrice)`).
- Prendre en compte `promotions.code` dans `POST /api/bookings`
  (`discount`, `total`).
- Pagination + tri stables (`orderBy id` en tie-breaker) partout où on
  paginee.

## UI / UX

- Envelopper `useSearchParams` dans `<Suspense>` (`reservation/page.tsx`).
- Passer les `<img>` à `next/image` + configurer `images.remotePatterns`.
- Bascule sur `next/font` pour Inter + Poppins.
- Dark mode.
- États vides et squelettes cohérents partout (les composants existent).
- Accessibilité : `sr-only` sur boutons icône-seul, focus visible cohérent,
  contrastes AA.
- I18n réelle (aujourd'hui tout est en français hard-codé). Le modèle
  supporte déjà `descriptionEn`, `users.language`.

## Qualité

- Ajouter un socle de tests :
  - Vitest pour les utilitaires (`lib/utils.ts`) et la logique de calcul de
    booking.
  - Un test d'intégration API par ressource principale (auth, properties,
    bookings).
  - Playwright pour un smoke test end-to-end (login → recherche → réservation).
- CI GitHub Actions (lint + typecheck + build).
- Ajouter `README.md` à la racine, `.env.example`, `LICENSE`.

## Perf

- Passer à `next/image` (voir UI).
- Mettre en cache les queries lourdes (revalidateTag / unstable_cache) sur
  la liste des properties « populaires ».
- Streaming RSC + `<Suspense>` sur les sections d'accueil.

## Dashboard hôte

- Éditeur de calendrier / prix / stop-sell (le modèle `room_availability`
  est prêt).
- Vue analytics réelle (revenus, taux d'occupation, ADR, RevPAR).
- Export CSV des réservations.
- Notifications (email/webhook) sur nouvelle réservation.

## Idées produit

- Intégration cartographique (Mapbox / Leaflet) sur `/recherche` et fiche.
- Filtre par équipements (`amenities`) sur la recherche.
- Comparateur d'hébergements.
- Système de codes de parrainage lié à `walletBalance`.
