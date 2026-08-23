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
| GET/POST/PATCH | `/api/rooms/[id]/rate-plans` | 👤 host propriétaire ou admin | Liste, crée, archive/réactive ou édite les plans proposés. Les modifications n’altèrent jamais les snapshots des bookings existants. |

## Bookings

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/bookings` | 🔒 | Filtré selon rôle : `customer` → siennes, `host` → sur ses properties, `admin` → toutes. Filtres additionnels : `status`, `propertyId`. Joint property, room, user. |
| POST | `/api/bookings` | 🔒 ou 👤 invité | Crée le hold après validation transactionnelle : dates, capacité adultes/enfants, stock par nuit, stop-sell et `minStay`. Prix journalier, TVA/réductions/wallet sont recalculés serveur. L’intent PSP est créé **après** commit avec clé d’idempotence ; le cron reprend un intent non rattaché avant TTL. Réponse `payment` distingue mock/wallet confirmés et Stripe `pending`. |
| GET | `/api/bookings/[id]` | 🔒 propriétaire, host de la property, ou admin | Détail booking, y compris états paiement/remboursement. |
| PUT | `/api/bookings/[id]` | 🔒 même règle | Voyageur : annulation uniquement. Hôte/admin : clôture contrôlée après départ. Annulation calcule frais et remboursement provider idempotent. |

## Reviews

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/reviews?propertyId=…` | 🔓 approved, 👤 host/admin modération | Public force `approved`; les statuts hidden/pending/rejected sont réservés à l’admin et à l’hôte propriétaire. `limit`/`offset` bornés. |
| POST | `/api/reviews` | 🔒 | Crée un avis pour un booking `completed` de l'utilisateur. Met à jour `properties.averageRating` et `totalReviews`. |

## Wishlists

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/wishlists` | 🔒 | Liste des wishlists de l'utilisateur avec items et propriétés jointes. |
| POST | `/api/wishlists` | 🔒 | Crée une wishlist (`name`, `isPublic?`) ou ajoute un item (`wishlistId`, `propertyId`). |
| PATCH | `/api/wishlists` | 🔒 propriétaire | Rend une liste publique/privée et génère ou renouvelle son `shareToken`. |
| DELETE | `/api/wishlists?wishlistId=…&propertyId?=…` | 🔒 propriétaire | Retire un item ou supprime la liste entière. |
| GET/POST | `/api/conversations` | 🔒 | Liste les fils accessibles ou ouvre/récupère le fil voyageur-hôte associé à une réservation. |
| GET/POST | `/api/messages` | 🔒 participant | Liste ou envoie les messages ; les nouvelles pièces jointes utilisent `attachmentKey` privé. |
| GET | `/api/messages/attachments/[id]` | 🔒 participant | Sert une pièce jointe privée après vérification conversation. |
| GET | `/api/cron/price-alerts` | 🔒 cron | Évalue alertes prix (quote de séjour si dates/voyageurs fournis, sinon prix de base), clôture séjours payés, reprend intents sans rattachement, expire holds, compense paiements tardifs et traite outbox/uploads ; `CRON_SECRET` obligatoire en production. |

## Administration des providers

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/providers/stripe` | 🔓 | Retourne uniquement la clé Stripe publiable résolue depuis env/coffre, jamais un secret serveur. |
| GET | `/api/admin/providers` | 👤 admin | Retourne uniquement metadata : provider, état, source, champs présents et date. Jamais les valeurs. |
| POST | `/api/admin/providers/[provider]` | 👤 admin | Test explicite : intent Stripe annulé, email Resend administrateur ou objet S3 temporaire supprimé. Aucune valeur retournée. |
| PUT | `/api/admin/providers/[provider]` | 👤 admin | Chiffre et stocke les champs saisis pour `stripe`, `resend` ou `s3`. Requiert `CREDENTIALS_ENCRYPTION_KEY` côté serveur. |
| DELETE | `/api/admin/providers/[provider]` | 👤 admin | Retire les overrides chiffrés après confirmation et repasse au fallback variables d’environnement. |
| POST | `/api/admin/providers/rotation` | 👤 admin | Réchiffre les overrides DB avec la clé primaire, après configuration temporaire de `CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`. Ne reçoit ni ne retourne aucun secret. |

| GET | `/api/dashboard/billing/export` | 👤 host/admin | Télécharge un CSV privé des bookings payés non annulés ; ce n’est pas une facture légale. |

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

- Les routes promotions, conversations, messages, rate-plans et disponibilité
  sont présentes dans `src/app/api`; ce document doit rester synchronisé avec
  leurs contrats réels.
- La capture Stripe live et les factures légales restent dépendantes de la
  configuration fournisseur et ne sont pas déclarées validées dans le sandbox.
