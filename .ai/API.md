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
| GET | `/api/auth/me` | 🔒 | Retourne le profil courant (sans le hash). Expose `notificationPrefs` (T-261) : `null` = héritage du réglage global, sinon `{ stayReminders?, reviewRequests?, moderationDecisions? }` normalisé. |
| POST | `/api/auth/2fa/setup` | 🔒 | Génère un secret TOTP `pending` (mot de passe courant requis, plus le code actif en cas de rotation). Aucun service tiers. |
| POST | `/api/auth/2fa/verify` | 🔒 | Promeut le secret `pending` et **retourne 10 codes de secours en clair une seule fois** (`{enabled:true, backupCodes:[…]}`, T-231) ; seules leurs empreintes bcrypt sont persistées. |
| POST | `/api/auth/2fa/disable` | 🔒 | Mot de passe + **code TOTP ou code de secours** (`XXXXX-XXXXX`, T-231). Purge secret, secret `pending` et codes de secours. |
| POST | `/api/auth/resend-guest-claim` | 🔓 (T-275, audit n°8 F5) | Renvoi de l'e-mail d'activation du **claim invité** quand le premier est perdu (spam) ou que sa fenêtre de 24 h est dépassée. Body strict `{bookingReference (5–50), guestEmail}` : la référence **et** l'e-mail exact du booking sont requis (double identification). Réponse **strictement générique 200** dans tous les cas (référence inconnue, e-mail non concordant, demande non `pending`, compte déjà claimé ou supprimé) — aucune divergence ne révèle l'existence d'une réservation (anti-énumération). Emission seulement si les 4 gardes sont franchies (une requête jointe `bookings ⋈ users`) : un jeton `guest_claim` neuf de 24 h (le lien précédent reste valable — `consumeToken` reste atomique, le premier consommé l'emporte) et un e-mail `guestAccountClaim` avec eventKey `guest-claim-resend:<bookingId>:<ts>` (l'initiale `guest-claim:<id>` idempotente n'est jamais rejouée). Rate-limit double **avant** toute lecture : 10/h par IP puis 3/h par email → `429` + `Retry-After`. Échec d'envoi = best-effort (jamais de 5xx). |

`POST /api/auth/login` accepte `totpCode` sous deux formes depuis T-231 : six chiffres (TOTP) ou un
code de secours à usage unique (consommé en base, un code déjà utilisé répond `401` avec un message
dédié). Un compte **suspendu** répond `401` avec le motif de suspension ; un compte **supprimé**
(anonymisé) répond `401` « Ce compte a été supprimé. Il n'est pas réactivable. » (T-230).

## Properties

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/properties` | 🔓 | Liste paginée (`limit` 1–100, `offset` ≥ 0) des properties `active`. Filtres : `city`, `country`, `type`, `guests`, `amenities` (csv), `checkIn`/`checkOut` (disponibilité), `minRating` (0–10, sinon **400**), `search` (ilike sur name/city/description), `near=lat,lng,km` (haversine, seuls les biens avec `latitude`/`longitude` renseignées), et post-filtrage `minPrice`/`maxPrice` sur le `min(basePrice)` des rooms. Tri `sort=rating|price_asc|price_desc|popularity` (défaut `rating`). `total` compte l'ensemble **après** tous les filtres (pagination fidèle). ⚠️ N+1 sur les rooms. **T-260** : ces quatre capacités (`sort=popularity`, `minRating`, `near`, `search`) sont désormais exposées par le formulaire `/recherche` ; `sort` hors liste blanche est signalé à l'utilisateur (bandeau T-175) sans changer la tolérance de l'API. |
| POST | `/api/properties` | 👤 `host`, `admin` | Crée une property. Génère un slug unique. Admin → `active`, host → `pending`. Accepte `checkInFrom`/`checkInUntil`/`checkOutUntil` (`HH:MM`, T-227) et `timezone` (IANA vérifié). Fenêtre d'arrivée vide (`début = fin`) → `400`. Les labels (`isEcoCertified`/`isBestrewards`/`isPreferred`) sont **réservés à l'admin** → `403` (T-228). |
| GET | `/api/properties/[id]` | 🔓 | Détail (avec rooms et reviews). |
| PATCH / PUT | `/api/properties/[id]` | 👤 propriétaire ou `admin` | Mise à jour partielle (le PUT partage le même schéma). Horaires/fuseau comme POST ; la fenêtre d'arrivée est validée sur **l'état résultant** de la fusion (T-227). Labels et `status` → `403` hors admin (T-228). |
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
| POST | `/api/bookings/[id]/payment` | 🔒 propriétaire/admin | Reprend le même hold/intention PSP avec la clé existante; ne crée pas une seconde réservation. |
| PUT | `/api/bookings/[id]` | 🔒 même règle | Voyageur : annulation uniquement. Hôte/admin : clôture contrôlée après départ (`completed` refusé en 409 tant que `paymentStatus !== "paid"`), `no_show` après le départ, confirmation manuelle d'une demande `pending`. Annulation calcule frais et remboursement provider idempotent. T-216 : chaque transition réellement appliquée écrit une entrée `booking.status.update` dans `audit_log` (y compris l'annulation, qui passe par `cancelBooking`). Aucun nouvel endpoint : c'est ce contrat qui alimente la colonne Statut de `/dashboard/bookings`. |
| PUT | `/api/bookings/[id]` (body `markPaidOffline`) | 🔒 hôte du bien ou admin | Constate le règlement sur place : `paymentStatus="paid"`, `paymentMethodOffline=true`, TTL libéré. Idempotent ; 409 si la réservation est annulée/no-show. |
| POST | `/api/bookings/[id]/refund` | 🔒 hôte du bien ou admin (T-273, audit n°8 F3) | **Finalise un remboursement déjà effectué hors plateforme** (espèces, virement) : `{reason}` (3–500, strict) → `refundStatus="refunded"`, `refundedAt`, `refundAmount=total` (devise de la réservation) dans une transaction `FOR UPDATE`. Gardes : `paymentStatus="paid"`, `refundStatus="none"`, `paymentIntentId IS NULL` (la voie PSP reste exclusivement Stripe), réservation non `pending` → `409` sinon ; `409` idempotent au 2e appel. Trace `booking.refund.manual` dans `audit_log` (`{host, reason, refundAmount, currency}`) + e-mail `refund-finalized:<id>` au voyageur (best-effort, jamais d'interrupteur — information contractuelle). Aucun contact PSP. |

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/reviews?propertyId=…` | 🔓 approved, 👤 host/admin modération | Public force `approved`; les statuts hidden/pending/rejected sont réservés à l’admin et à l’hôte propriétaire. `limit`/`offset` bornés. |
| POST | `/api/reviews` | 🔒 | Crée un avis pour un booking `completed` de l'utilisateur. Met à jour `properties.averageRating` et `totalReviews`. |

## Wishlists

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/wishlists` | 🔒 | Liste des wishlists de l'utilisateur avec items et propriétés jointes. |
| POST | `/api/wishlists` | 🔒 | Crée une wishlist (`name`, `isPublic?`) ou ajoute un item (`wishlistId`, `propertyId`). |
| PATCH | `/api/wishlists` | 🔒 propriétaire | Rend une liste publique/privée et génère ou renouvelle son `shareToken`. **T-246** : accepte aussi `name` (1-80 caractères, `trim`) pour **renommer** ; champ optionnel, donc les appels de partage existants sont inchangés. |
| DELETE | `/api/wishlists?wishlistId=…&propertyId?=…` | 🔒 propriétaire | Retire un item ou supprime la liste entière. |
| POST | `/api/wishlists/move` | 🔒 propriétaire | **T-246** — déplace un favori : `{propertyId, fromWishlistId, toWishlistId}`. Insertion dans la liste cible **puis** suppression de la source dans une **même transaction** (aucun doublon, aucun favori perdu). `404` si une liste n'appartient pas à l'appelant ou si le favori n'est pas dans la source, `400` si les deux listes sont identiques ou si le bien est déjà présent. |
| GET/POST | `/api/conversations` | 🔒 | Liste les fils accessibles ou ouvre/récupère le fil voyageur-hôte associé à une réservation. |
| GET/POST | `/api/messages` | 🔒 participant | Liste ou envoie les messages ; les nouvelles pièces jointes utilisent `attachmentKey` privé. |
| GET | `/api/messages/attachments/[id]` | 🔒 participant | Sert une pièce jointe privée après vérification conversation. |
| GET | `/api/wallet/transactions` | 🔒 | **T-248** — historique du journal du wallet (`wallet_transactions`) de l'appelant : `{transactions: [{id, amount, balanceAfter, kind, bookingId, note, createdAt}], total, balance}`. Lecture seule ; `kind` ∈ `cashback\|referral_referee\|referral_referrer\|booking_refund\|booking_payment\|manual_adjustment`. Pagination opt-in (`limit` 1-100, défaut 20) + `X-Total-Count`. |
| GET | `/api/cron/price-alerts` | 🔒 cron | Évalue alertes prix (quote de séjour si dates/voyageurs fournis, sinon prix de base), clôture séjours payés, reprend intents sans rattachement, expire holds, compense paiements tardifs et traite outbox/uploads ; `CRON_SECRET` obligatoire en production. |

## Validation et commission des hôtes

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| GET | `/api/admin/hosts` | 👤 admin | Liste les comptes `host` (filtres `status=pending\|approved\|rejected`, `q` sur l'email) avec `approvalStatus`, `commissionRate`, `propertyCount` (nombre réel d’hébergements — la sous-requête corrélée doit rester **qualifiée** : `${users.id}` seul se résolvait sur `properties.id` et renvoyait 0, BUG-050). |
| GET | `/api/admin/hosts/[id]` | 👤 admin | T-215 — état de commission d'un hôte et **impact** d'une modification, en lecture seule : `hostRate`, `globalRate`, `effectiveRate`, `inheritCount` (hébergements `commission_rate IS NULL`, donc suivant le taux hôte), `explicitCount`, détail par hébergement. |
| PATCH | `/api/admin/hosts/[id]` | 👤 admin | `action:"approve"` (avec `commissionRate` optionnel) / `"reject"` : contrat T-202 inchangé. `action:"updateCommission"` (T-215) : fixe `users.commissionRate` quel que soit l'état d'approbation, `null` = retour à l'héritage du taux global ; `applyTo:"inherited"` ne touche que les hébergements sans taux explicite, `applyTo:"listed"` + `propertyIds` (≤ 100) uniquement ceux transmis — **jamais** de propagation implicite ni de recalcul des réservations existantes (`bookings.commissionRate/Amount/netToHost` sont des snapshots de vente, ADR-009). Audit : `host.commission.update` (+ `property.commission.update` par hébergement propagé). |

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

## Pagination (T-245, additive)

`GET /api/bookings` et `GET /api/messages` acceptent `limit` (1-100, défaut 20) et
`offset` (≥ 0) : **sans paramètre, la réponse historique est inchangée** (tableau
complet, même enveloppe) ; avec, la réponse est bornée et l'en-tête
`X-Total-Count` porte le total. Bornes invalides → `400` explicite
(`limit` non entier, `offset` négatif, `limit=0`). Même mécanique sur
`GET /api/wallet/transactions` (T-248).

## Supervision (T-250, additive)

`GET /api/health` conserve `{ok, database}` et ajoute `cronStatus`
(`ok\|stale\|failed\|missing\|unknown`), `crons[]` (dernière exécution, âge,
durée, compteurs, erreur, cadence attendue) et `checkedAt`. Le code HTTP reste
`200` tant que la base répond : l'état des crons est **informatif**, il ne rend
pas la sonde indisponible.

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

## Utilisateurs (T-230 / T-231, additives)

| Méthode | Route | Auth | Ce qu'elle fait |
|---|---|---|---|
| DELETE | `/api/users/me` | 🔒 | Suppression définitive : anonymisation **transactionnelle** (`src/lib/account-anonymization.ts`, T-242) — e-mail haché, nom effacé, 2FA et codes de secours purgés, `bookings.guest_*`, `email_outbox.to` et `audit_log.metadata.targetEmail` nettoyés, sessions supprimées. Les agrégats comptables (référence, dates, montants, commission) restent intacts. |
| PATCH | `/api/users/[id]/suspend` | 🔒 `admin` | `{suspended:true, reason?}` → `suspendedAt` + révocation des sessions ; `{suspended:false}` → réactivation. **Un compte supprimé (anonymisé) répond `409`** dans les deux sens (T-230) : suspension et suppression ne partagent plus `deleted_at`. |
| POST | `/api/users/[id]/two-factor/reset` | 🔒 `admin` | Dernier recours support (T-231) : purge la 2FA (secret, `pending`, codes de secours), révoque les sessions, trace `user.2fa.reset` et envoie un e-mail d'information. `400` si la 2FA n'est pas active, `409` sur compte supprimé. |

`PATCH /api/users/me` valide `timezone` (fuseau IANA reconnu, sinon `400`) et accepte
`notificationPrefs` (**T-261**) : objet **strict** limité à `stayReminders` / `reviewRequests` /
`moderationDecisions`, `null` pour effacer la colonne (`users.notification_prefs`) et revenir à
l'héritage du réglage global ; une clé inconnue → **400** (`issues[].field`). La réponse renvoie le
réglage normalisé, comme `priceAlertEnabled`. Les e-mails transactionnels ne sont pas réglables par
cette route (voir `.ai/KNOWN_LIMITATIONS.md`).

Les actions bulk `suspend`/`reactivate` de `/api/admin/bulk` suivent les mêmes règles (T-230) :
`reactivate` sur un compte anonymisé est **ignoré avec motif** et compté en `skipped`.

## Extensions T-217 (additives)

- `PATCH /api/promotions/[id]` accepte désormais `maxUses: null` et
  `maxDiscount: null` pour revenir à « illimité » (les valeurs numériques et les
  gardes T-126 restent identiques).
- `GET /api/admin/audit` (pagination `limit`/`offset`, filtre `action`) est
  branchée par `/dashboard/audit` ; `src/lib/audit-rows.ts` partage la
  projection serveur/client.

## Surfaces volontairement inactives

`GET /api/providers/stripe`, `POST /api/webhooks/stripe`,
`POST /api/bookings/[id]/payment` (410) et `GET /api/cron/payouts` (410) ne sont
appelées par aucun écran : voir `.ai/KNOWN_LIMITATIONS.md` → « Surfaces
inactives ».

## Ce qui n'existe pas encore

- Les routes promotions, conversations, messages, rate-plans et disponibilité
  sont présentes dans `src/app/api`; ce document doit rester synchronisé avec
  leurs contrats réels.
- La capture Stripe live et les factures légales restent dépendantes de la
  configuration fournisseur et ne sont pas déclarées validées dans le sandbox.
