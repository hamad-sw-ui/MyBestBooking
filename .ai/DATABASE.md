# 🗄️ Base de données

- **Moteur** : PostgreSQL
- **ORM** : Drizzle (`drizzle-orm` 0.45)
- **Driver** : `pg` (Pool)
- **Schéma** : un seul fichier `src/db/schema.ts`
- **Config** : `drizzle.config.json` (`dialect: postgresql`, DB de dev sur
  `postgresql://postgres:postgres@127.0.0.1:5432/app_db`)
- **Migrations versionnées** : ⚠️ pas encore en place. Aujourd'hui, la synchro
  se fait avec `drizzle-kit push` en dev. À formaliser (`drizzle-kit generate`
  → dossier `drizzle/`, à commiter).

Toutes les tables utilisent :

- Une clé primaire `uuid` générée par la base (`defaultRandom()`).
- `createdAt` / `updatedAt` en `timestamp` avec `defaultNow()`.

## Tables

### `users`
Compte unifié voyageur / hôte / admin.

Colonnes clés : `email` (unique), `passwordHash`, `firstName`, `lastName`,
`phone`, `role` (`customer` | `host` | `admin`, défaut `customer`),
`bestrewardsLevel` (1..3), `bestrewardsBookingsCount`, `walletBalance`,
`language`, `currency`, `country`, `timezone`, `twoFactorEnabled`,
`lastLoginAt`, `deletedAt` (soft-delete).

### `sessions`
`userId`, `token` (unique — le JWT), `expiresAt`. Chaque login insère une ligne,
`logout` la supprime.

### `properties`
Hébergement publié par un `host`.

Colonnes clés : `hostId`, `name`, `slug` (unique), `type`
(`hotel`|`apartment`|`house`|`villa`|`hostel`|`resort`|`bnb`|`guesthouse`|`riad`|`camping`),
`description(_en)`, `starRating` (0-5), adresse complète, `latitude/longitude`,
`timezone`, horaires check-in/out, `cancellationPolicy`, drapeaux
(`petsAllowed`, `smokingAllowed`, `isBestrewards`, `isPreferred`, `isEcoCertified`),
`averageRating`, `totalReviews`, `commissionRate` (défaut 15.00),
`status` (`pending`|`active`|`draft`|`suspended`), `validatedAt/By`,
`amenities` (jsonb `string[]`), `images` (jsonb `string[]`), `mainImage`.

Index : `(city, status)`, `(country, status)`.

### `rooms`
Type de chambre / unité louable sous une property.

Clés : `propertyId`, `name`, `roomType` (`single`|`double`|`twin`|`suite`|`studio`|`dormitory`|`family`),
`bedConfiguration` (jsonb `{type, count}[]`), `maxOccupancy`, `maxAdults`,
`maxChildren`, `sizeSqm`, `quantity`, `basePrice`, `currency` (défaut EUR),
`amenities`, `images`, `isActive`.

### `rate_plans`
Plans tarifaires attachés à une `room` : `type`, `discountPercentage`,
`includesBreakfast`, `cancellationPolicy`, `cancellationFreeDays`, `conditions`
(jsonb), `isActive`.

### `room_availability`
Inventaire journalier par room : `date`, `availableCount`, `price` (override),
`stopSell`, `minStay`.

### `bookings`
Réservation confirmée. `bookingReference` unique, format `MBB-YYYY-XXXXXX`
(voir `generateBookingReference()` dans `src/lib/utils.ts`).

Clés : `userId`, `propertyId`, `roomId`, `status` (`pending`|`confirmed`|`cancelled`|`completed`|`no_show`),
dates `checkIn`/`checkOut`, `numNights`, `numAdults`, `numChildren`,
identité invité (`guestFirst/Last/Email/Phone/Country`), `tripPurpose`
(`leisure`|`business`), `specialRequests`, `estimatedArrival`,
montants (`subtotal`, `taxes`, `fees`, `discount`, `total`), `currency`,
`paymentStatus` (`pending`|`paid`|`refunded`|`failed`), `paymentMethod`,
et la ventilation commission : `commissionRate`, `commissionAmount`, `netToHost`.
`cancelledAt`, `cancellationReason`, `cancellationFee`.

Index : `(userId, status)`, `(propertyId, checkIn, checkOut)`.

### `reviews`
Avis vérifié, 1 à 1 avec `bookings` (`bookingId` unique).

Notes : `overallRating` + 7 notes détaillées (`cleanliness`, `comfort`,
`location`, `facilities`, `staff`, `value`, `wifi`), commentaires positif/négatif,
`travelerType`, `isVerified`, `status`, réponse hôte (`hostReply`, `hostReplyAt`),
`helpfulCount`.

Index : `(propertyId, status)`.

### `wishlists` + `wishlist_items`
Listes de favoris d'un utilisateur, `isPublic` + `shareToken` unique
(partage par lien). Chaque item peut avoir `priceAlertEnabled`.

### `conversations` + `messages`
Messagerie voyageur ↔ hôte, éventuellement rattachée à un `booking`.
Compteurs `unreadByUser` / `unreadByHost`, `senderType` = `user` | `host`,
pièce jointe optionnelle `attachmentUrl`.

### `promotions`
Codes promo globaux : `code` unique, `type` + `value`, `minBookingAmount`,
`maxDiscount`, plage `validFrom` / `validUntil`, `maxUses` / `currentUses`.
Non branchés dans le tunnel de réservation aujourd'hui.

## Types TypeScript exportés

`src/db/schema.ts` réexporte :

```ts
User, NewUser, Property, NewProperty, Room, NewRoom,
Booking, NewBooking, Review, NewReview
```

À utiliser à la place de types dupliqués côté client.

## Points d'attention

- **Pas d'unicité** sur `wishlist_items (wishlistId, propertyId)` — un même
  hébergement peut être ajouté deux fois.
- **Pas d'unicité** sur `room_availability (roomId, date)` — attendue en général.
- **`averageRating` et `totalReviews`** sur `properties` sont recalculés à la
  main dans `POST /api/reviews` ; à surveiller en cas de concurrence.
- **Pas de contrainte** empêchant `checkIn >= checkOut`.
- Les colonnes monétaires sont `decimal(10,2)` — bien utiliser `parseFloat` /
  `toFixed(2)` côté serveur, jamais des flottants approximatifs.
