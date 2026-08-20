# 🔌 API REST

Toutes les routes vivent sous `src/app/api/**/route.ts`. Tous les corps de
requête sont validés avec **Zod**. Les réponses sont du JSON.

Authentification :
- 🔓 = public
- 🔒 = utilisateur connecté requis (`getCurrentUser()`)
- 👤 = restreint par rôle (précisé)

## Système

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/health` | 🔓 | `select 1` sur la DB, retourne `{ok:true}` ou 500 |
| POST | `/api/seed` | 🔓 en dev / 🔒 en prod | Idempotent : peuple 8 propriétés de démo + 3 comptes (admin, host, customer) si la base est vide. En production, retourne 404 sauf si l'en-tête `x-seed-token` correspond à `process.env.SEED_TOKEN` (voir ADR-004, BUG-002). |

## Auth

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| POST | `/api/auth/register` | 🔓 | Crée un `users`, hash bcrypt, ouvre une session. Body : `{email, password (≥8), firstName, lastName, role?}`. |
| POST | `/api/auth/login` | 🔓 | Vérifie mdp, met à jour `lastLoginAt`, ouvre une session. |
| POST | `/api/auth/logout` | 🔓 | Supprime la session en base + le cookie, `302 → /`. |
| GET | `/api/auth/me` | 🔒 | Retourne le profil courant (sans le hash). |

## Properties

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/properties` | 🔓 | Liste paginée (`limit`, `offset`) des properties `active`. Filtres : `city`, `country`, `type`, `minRating`, `search` (ilike sur name/city/description), et post-filtrage `minPrice`/`maxPrice` sur le `min(basePrice)` des rooms. Trié par `averageRating desc`. ⚠️ N+1 sur les rooms. |
| POST | `/api/properties` | 👤 `host`, `admin` | Crée une property. Génère un slug unique. Admin → `active`, host → `pending`. |
| GET | `/api/properties/[id]` | 🔓 | Détail (avec rooms et reviews). |
| PATCH | `/api/properties/[id]` | 👤 propriétaire ou `admin` | Mise à jour partielle. |
| DELETE | `/api/properties/[id]` | 👤 propriétaire ou `admin` | Suppression (soft/hard selon impl.). |

## Rooms

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/rooms?propertyId=…` | 🔓 | Liste les rooms actives d'une property. `propertyId` requis. |
| POST | `/api/rooms` | 👤 host propriétaire ou `admin` | Crée une room. |
| GET | `/api/rooms/[id]` | 🔓 | Détail room. |
| PATCH | `/api/rooms/[id]` | 👤 host propriétaire ou `admin` | Mise à jour partielle. |
| DELETE | `/api/rooms/[id]` | 👤 host propriétaire ou `admin` | Suppression. |

## Bookings

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/bookings` | 🔒 | Filtré selon rôle : `customer` → siennes, `host` → sur ses properties, `admin` → toutes. Filtres additionnels : `status`, `propertyId`. Joint property, room, user. |
| POST | `/api/bookings` | 🔒 | Crée une réservation. Calcule `numNights`, `subtotal = basePrice*nuits`, `taxes = 10%`, `total`, `commission`, `netToHost`. Force `status='confirmed'` et `paymentStatus='paid'` (⚠️ paiement mocké). Incrémente `bestrewardsBookingsCount` et recalcule le niveau (seuils 5, 15). |
| GET | `/api/bookings/[id]` | 🔒 propriétaire, host de la property, ou admin | Détail booking. |
| PATCH | `/api/bookings/[id]` | 🔒 même règle | Ex. annulation (`status='cancelled'`, `cancelledAt`, `cancellationReason`). |
| DELETE | `/api/bookings/[id]` | 👤 admin | Suppression. |

## Reviews

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/reviews?propertyId=…` | 🔓 | Liste des avis approuvés pour une property. |
| POST | `/api/reviews` | 🔒 | Crée un avis pour un booking `completed` de l'utilisateur. Met à jour `properties.averageRating` et `totalReviews`. |

## Wishlists

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/wishlists` | 🔒 | Liste des wishlists de l'utilisateur avec items et propriétés jointes. |
| POST | `/api/wishlists` | 🔒 | Crée une wishlist (`name`, `isPublic?`). Ou ajoute un item si le body contient `wishlistId` + `propertyId`. |
| DELETE | `/api/wishlists?itemId=…` | 🔒 | Retire un item. |

## Conventions

- **Erreurs de validation** Zod → `400 {error: <premier message>}` (on utilise
  `error.issues[0].message`).
- **Auth manquante** → `401 {error: "Non autorisé"}` (ou `"Veuillez vous connecter…"`
  selon le contexte).
- **Erreurs serveur** → `500 {error: "Une erreur est survenue"}` +
  `console.error()`.
- **Réponses succès** :
  - Création → `201 {…}` avec la ressource sous une clé nommée
    (`{property: …}`, `{booking: …}`).
  - Lecture liste → `200 {properties: [...]}` / `{bookings: [...]}` etc.
- **Filtrage par rôle** : dans les listes, on filtre **au niveau du WHERE SQL**
  (pas après), sauf `GET /api/properties` qui post-filtre `minPrice/maxPrice`.

## Ce qui n'existe pas encore

- Pas d'endpoint `/api/promotions` — la table existe, aucune route.
- Pas d'endpoint `/api/conversations` ni `/api/messages` — les pages `messages`
  utilisent probablement une lecture serveur directe ou sont partiellement
  mockées.
- Pas d'endpoint `/api/rate-plans` ni `/api/room-availability`.
- Pas de webhook / callback de paiement (car pas de paiement).
