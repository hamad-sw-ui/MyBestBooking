# 🎯 FEATURES — inventaire de complétude produit

> **Source de vérité de « ce que MyBestBooking devrait faire »**.
> Distinct de `BACKLOG.md` (actions à faire) et `BUGS.md` (défauts).
> Vérifié par R14, R17 de `scripts/check-ai.mjs`.

## Légende

- ✅ **livré + testé** (au moins un test automatisé passant)
- 🚧 **partiel** (préciser ce qui manque)
- 🎯 **PROMISED** (planifié, tâche ouverte, non commencé — voir §16)
- ❌ **absent, non planifié**

Chaque changement de statut doit être commité **dans la même PR** que la
modification de code.

---

## Auth & compte

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Inscription email/mdp | ✅ | `POST /api/auth/register` + rate-limit + `emailVerified:false` | T-001, T-008, T-009 |
| Connexion email/mdp | ✅ | `POST /api/auth/login` + rate-limit | T-001, T-009 |
| Déconnexion | ✅ | `POST /api/auth/logout` supprime session + cookie | initial |
| Session serveur JWT + révocable | ✅ | table `sessions` + `getSession()` vérifie DB | initial |
| Profil courant | ✅ | `GET /api/auth/me` | initial |
| Édition profil (nom, tél, pays) | 🚧 | UI `/mon-compte` existe, aucune route `PATCH /api/users/me` | 🎯 T-016 |
| Changement de mot de passe | 🚧 | UI présente, aucune route `POST /api/auth/change-password` | 🎯 T-016 |
| Mot de passe oublié (email de reset) | ❌ | Aucune route, aucune UI | 🎯 T-013 |
| Vérification email (envoi + confirmation via lien) | ❌ | Champ `emailVerified` mais aucun envoi ni handler `/api/auth/verify` | 🎯 T-013 |
| 2FA (TOTP ou SMS) | ❌ | Flag `twoFactorEnabled` en DB seulement | 🎯 backlog |
| Suppression du compte | ❌ | Champ `deletedAt` en DB, aucune UI ni route | 🎯 backlog |

## Recherche & découverte

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Liste properties actives paginée | ✅ | `GET /api/properties` + limit/offset | T-004 |
| Filtre par ville, pays, type, note, prix, recherche texte | ✅ | Query params sur `/api/properties` | T-004 |
| Filtre par équipements (`amenities`) | ❌ | Schéma le supporte, endpoint ne l'expose pas | 🎯 backlog |
| Filtre par dates (disponibilité) | ❌ | Aucune vérification `room_availability` dans la recherche | 🎯 T-012 |
| Filtre par nombre de voyageurs | ❌ | Aucun paramètre | 🎯 backlog |
| Tri (prix, note, distance) | 🚧 | Trié par `averageRating desc` seulement | 🎯 backlog |
| Fiche property complète (photos, chambres, avis) | ✅ | `GET /api/properties/[id]` + page `/hebergement/[slug]` | initial |
| Carte géographique (Mapbox/Leaflet) | ❌ | `latitude/longitude` en DB, aucun rendu carte | 🎯 backlog |

## Réservation

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Tunnel multi-étapes | ✅ | `/reservation` avec `<Suspense>` | T-005 |
| Calcul commission + net-to-host | ✅ | `POST /api/bookings` calcule | initial |
| Contraintes dates cohérentes | ✅ | Zod refine + CHECK SQL | T-006 |
| **Vérification de disponibilité `room_availability`** | ❌ | Rien ne vérifie ni décrémente stock | 🎯 T-012 |
| **Détection de chevauchement avec bookings existants** | ❌ | Deux voyageurs peuvent réserver la même chambre | 🎯 T-012 |
| **Application d'un code promo** | ❌ | Champ `discount` toujours à 0 | 🎯 T-015 |
| **Application `rate_plans`** (petit-déj, remboursable) | ❌ | Table présente, aucun endpoint ni UI | 🎯 backlog |
| **Politique d'annulation réelle** | 🚧 | Statut `cancelled` possible via `PUT /api/bookings/[id]`, mais pas de calcul de `cancellationFee` selon `cancellationPolicy` | 🎯 T-015 |
| Annulation par le voyageur | 🚧 | Route existe, UI existe, aucun frais appliqué | 🎯 T-015 |
| **Paiement réel (Stripe/CinetPay)** | ❌ | `paymentStatus: 'paid'` forcé sans débit | 🎯 T-020 |
| **Webhook confirmation paiement** | ❌ | Aucun handler `/api/webhooks/*` | 🎯 T-020 |
| **Email de confirmation** | ❌ | Aucun envoi | 🎯 T-013 |
| **Email d'annulation** | ❌ | Aucun envoi | 🎯 T-013 |
| Récupération « mes réservations » | ✅ | `GET /api/bookings` filtré par rôle | initial |
| Détail d'une réservation | ✅ | `GET /api/bookings/[id]` | initial |

## Avis

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Créer un avis vérifié après séjour | ✅ | `POST /api/reviews` | initial |
| Lecture des avis d'une property | ✅ | `GET /api/reviews?propertyId=` | initial |
| Recalcul atomique `averageRating` | ✅ | `UPDATE...FROM(SELECT AVG…)` | T-007 |
| **Réponse hôte à un avis** | ❌ | Champ `hostReply` en DB, bouton « Répondre » dans dashboard mais aucun `POST /api/reviews/[id]/reply` | 🎯 T-015 |
| **Modération admin** (approuver/rejeter) | ❌ | `status` en DB, aucun endpoint | 🎯 T-015 |
| Marquer un avis comme utile (`helpfulCount`) | ❌ | Champ en DB seulement | 🎯 backlog |

## Favoris (wishlists)

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Créer une wishlist | ✅ | `POST /api/wishlists` | initial |
| Ajouter/retirer une property | ✅ | `POST/DELETE /api/wishlists` | initial |
| Contrainte unicité item | ✅ | `UNIQUE (wishlist_id, property_id)` | T-006 |
| **Partage public par lien (shareToken)** | 🚧 | `shareToken` généré à la création si `isPublic:true`, aucune route `GET /api/wishlists/shared/[token]` ni page | 🎯 T-015 |
| Alertes prix (`priceAlertEnabled`) | ❌ | Champ en DB seulement | 🎯 backlog |

## Messagerie voyageur ↔ hôte

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Liste des conversations | 🚧 | Page `/messages` + `/dashboard/messages` lisent la DB, seed n'en crée aucune | 🎯 T-015 |
| **Créer une conversation** | ❌ | Aucun `POST /api/conversations` | 🎯 T-015 |
| **Envoyer un message** | ❌ | Aucun `POST /api/messages`, aucun formulaire d'envoi | 🎯 T-015 |
| **Marquer comme lu** | ❌ | Compteurs `unreadByUser/Host` en DB, jamais mis à jour | 🎯 T-015 |
| Pièce jointe | ❌ | Champ `attachmentUrl` en DB seulement | 🎯 backlog |
| Notification email nouveau message | ❌ | Rien | 🎯 T-013 |

## Programme BestRewards (fidélité)

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Compteur de bookings + niveau (1→3) | ✅ | Incrément dans `POST /api/bookings` | initial |
| Affichage niveau dans le header | ✅ | Composant Header | initial |
| Page publique explicative | ✅ | `/bestrewards` | initial |
| **Réduction appliquée pour les properties `isBestrewards`** | ❌ | Flag décoratif, aucun calcul | 🎯 backlog |
| **Wallet utilisable au checkout** | ❌ | `walletBalance` en DB, jamais lu ni écrit | 🎯 backlog |
| Parrainage / codes personnels | ❌ | — | 🎯 backlog |

## Hébergeur (dashboard host)

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Vue d'ensemble | ✅ | `/dashboard` | initial |
| Liste properties + création formulaire | 🚧 | `POST /api/properties` OK ; formulaire attend une URL d'image (pas d'upload) | 🎯 T-014 |
| **Upload d'images (photo hébergement, chambre, avatar)** | ❌ | Aucun endpoint, aucun stockage | 🎯 T-014 |
| Édition property | 🚧 | `PATCH /api/properties/[id]` existe, UI incomplète (page détail lit seulement) | 🎯 T-015 |
| Suppression property | ✅ | `DELETE /api/properties/[id]` | initial |
| Liste rooms | 🚧 | Page lecture OK, formulaire d'ajout absent côté UI | 🎯 T-015 |
| Édition room | 🚧 | `PATCH /api/rooms/[id]` existe, UI absente | 🎯 T-015 |
| **Éditeur calendrier prix/stock/stop-sell** | ❌ | Tables `room_availability` + `rate_plans` prêtes, aucun endpoint ni UI | 🎯 T-018 |
| Liste bookings de l'hôte | ✅ | `GET /api/bookings` filtré par host | initial |
| Détail booking | ✅ | Page + endpoint | initial |
| Répondre à un avis | ❌ | Voir section Avis | 🎯 T-015 |
| Répondre à un message | ❌ | Voir section Messagerie | 🎯 T-015 |
| Analytics revenus / occupation | 🚧 | Page requête DB, uniquement 30j simples ; pas d'ADR/RevPAR, pas d'export | 🎯 backlog |
| Facturation (billing) | 🚧 | Page lecture, aucun téléchargement facture réel | 🎯 backlog |
| Notifications email/webhook sur nouvelle réservation | ❌ | Rien | 🎯 T-013 |

## Admin

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Liste des utilisateurs | 🚧 | Page `/dashboard/users` lit la DB, aucune action (suspend, promouvoir…) | 🎯 T-015 |
| **Validation d'une property (`pending`→`active`)** | ❌ | Champs `validatedAt/By` en DB, workflow inexistant côté UI/API | 🎯 T-015 |
| **Modération d'avis** (approuver, cacher) | ❌ | Voir Avis | 🎯 T-015 |
| **CRUD codes promo** | 🚧 | Page liste, aucun POST/PUT/DELETE endpoint | 🎯 T-015 |
| Journal d'actions admin | ❌ | Pas de table `audit_log` | 🎯 backlog |
| Suspendre un utilisateur | ❌ | `deletedAt` soft delete existe mais aucun endpoint admin | 🎯 backlog |

## Emails transactionnels

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Service SMTP configuré (Resend/SendGrid/SES) | ❌ | Aucune lib installée | 🎯 T-013 |
| Email vérification à l'inscription | ❌ | — | 🎯 T-013 |
| Email reset password | ❌ | — | 🎯 T-013 |
| Email confirmation booking | ❌ | — | 🎯 T-013 |
| Email annulation booking | ❌ | — | 🎯 T-013 |
| Email nouvelle réservation → hôte | ❌ | — | 🎯 T-013 |
| Email nouveau message | ❌ | — | 🎯 T-013 |
| Templates HTML/text | ❌ | — | 🎯 T-013 |

## Uploads & stockage

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Adapter stockage (S3/R2/Vercel Blob/local dev) | ❌ | — | 🎯 T-014 |
| Endpoint `POST /api/uploads` avec validation MIME + taille | ❌ | — | 🎯 T-014 |
| Composant `<ImageUploader>` | ❌ | — | 🎯 T-014 |
| Suppression d'un upload | ❌ | — | 🎯 T-014 |

## SEO & metadata

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Metadata root (title/description) | ✅ | `src/app/layout.tsx` | initial |
| Metadata par page (`generateMetadata`) | ❌ | Seule la home hérite | 🎯 T-017 |
| OpenGraph + Twitter Card | ❌ | — | 🎯 T-017 |
| `sitemap.xml` | ❌ | Aucun fichier `sitemap.ts` | 🎯 T-017 |
| `robots.txt` | ❌ | Aucun fichier `robots.ts` | 🎯 T-017 |
| Schema.org (Hotel, LodgingReservation, Review) | ❌ | — | 🎯 T-017 |

## Accessibilité (a11y)

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| `alt` sur toutes les images | 🚧 | `next/image` posé partout où on migre, PropertyCard/home OK, reste des `<img>` | 🎯 T-017 |
| `aria-label` sur les boutons icône-seul | ❌ | ~35 boutons sans label (grep) | 🎯 T-017 |
| `<label htmlFor>` sur tous les inputs | 🚧 | Composants ui/input abstraient, à vérifier | 🎯 T-017 |
| Navigation clavier + focus visible | ❌ | Non testé | 🎯 T-017 |
| Audit axe-core / Lighthouse | ❌ | Jamais lancé | 🎯 T-017 |
| Skip links | ❌ | — | 🎯 T-017 |

## i18n

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Toutes les chaînes en français hard-codées | 🚧 | Fonctionne mais rigide | (par choix v1) |
| Support EN via `descriptionEn` | ❌ | Champ DB, jamais lu | 🎯 backlog |
| Bibliothèque i18n (next-intl) | ❌ | — | 🎯 backlog |
| Devise dynamique | ❌ | EUR partout, `users.currency` ignoré | 🎯 backlog |

## Sécurité durcie

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| JWT_SECRET obligatoire | ✅ | throw au boot | T-001 |
| Rate-limit login/register | ✅ | mémoire | T-009 |
| Headers sécurité globaux | ✅ | HSTS + nosniff + Frame + Referrer + Permissions | T-008 |
| Cookies HttpOnly + SameSite=Lax + Secure prod | ✅ | initial | initial |
| Seed protégée en prod | ✅ | timing-safe token | T-002 |
| Middleware/proxy edge | ✅ | jose | T-003 |
| CSP fine (`Content-Security-Policy`) | ❌ | Manque | 🎯 T-017 |
| CSRF token explicite (double submit) | ❌ | `SameSite=Lax` couvre 95%, pas 100% | 🎯 backlog |
| Rate-limit sur `/api/bookings`, `/api/reviews`, `/api/wishlists` | ❌ | Utilisateur connecté peut spammer | 🎯 T-015 |
| Rate-limit Redis (multi-instance) | ❌ | Mono-instance mémoire | 🎯 backlog |
| Rotation de secret documentée + procédure | ❌ | — | 🎯 backlog |

## Qualité, tests, CI

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Vitest unitaires (utils, auth, rate-limit) | ✅ | 43 tests | T-001 T-002 T-009 |
| Test d'intégration `/api/auth/*` | 🚧 | Contrat JWT_SECRET couvert, pas l'intégration DB réelle | 🎯 T-019 |
| **Test d'intégration `/api/bookings`** | ❌ | Cœur métier non testé | 🎯 T-019 |
| Test d'intégration `/api/properties`, `/api/wishlists`, `/api/reviews`, `/api/rooms` | ❌ | — | 🎯 T-019 |
| Tests composants React | ❌ | `PropertyCard`, `Header`, `Modal`, `Toast` non testés | 🎯 T-019 |
| **Playwright E2E** | 🚧 | Installé (T-011), 1 smoke test | 🎯 T-019 |
| Couverture code mesurée | ❌ | `vitest --coverage` disponible, jamais lancé en CI | 🎯 T-019 |
| CI GitHub Actions | 🚧 | Fichier prêt (`.ai/REPORTS/ci_workflow_a_ajouter.md`), non installé sur GitHub | 🎯 manuel |
| Dependabot / Renovate | ❌ | — | 🎯 backlog |

## Observabilité & prod

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Health check DB (`/api/health`) | ✅ | `SELECT 1` | initial |
| Monitoring erreurs (Sentry) | ❌ | Uniquement `console.error` | 🎯 backlog |
| Télémétrie applicative | ❌ | — | 🎯 backlog |
| Logs structurés | ❌ | `console.*` non JSON | 🎯 backlog |
| Dockerfile prod | ❌ | — | 🎯 backlog |
| Runbook incident | ❌ | — | 🎯 backlog |
| Backup DB automatique | ❌ | — | 🎯 backlog |

## UX transverses

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Design system interne | ✅ | Card, Button, Input, Badge, Modal, Toast, Skeleton, EmptyState | initial |
| Toast provider monté | ✅ | root layout | initial |
| **useToast effectivement appelé** | ❌ | Aucune page ne l'utilise | 🎯 T-015 |
| **Modal effectivement utilisée** | ❌ | Aucun `<Modal>` dans le code | 🎯 T-015 |
| `error.tsx` global | ❌ | Aucun | 🎯 T-017 |
| `not-found.tsx` custom | ❌ | Aucun | 🎯 T-017 |
| `loading.tsx` par route | ❌ | Aucun | 🎯 T-017 |
| Dark mode | ❌ | Tokens neutres, pas de bascule | 🎯 backlog |
| `next/font` (Inter + Poppins) | ❌ | Chargés via `<link>` (12 warnings ESLint) | 🎯 T-017 |
| Mode invité au checkout | ❌ | Compte obligatoire | 🎯 backlog |

---

## 📊 Bilan de complétude

Recalculé au 2026-08-20 après audit Session 5 :

| État | Nombre |
|---|---|
| ✅ Livré + testé | ~34 |
| 🚧 Partiel | ~18 |
| 🎯 PROMISED | ~45 |
| ❌ Absent | ~25 |
| **Total tracé** | **~122** |

**Couverture ✅ = 28 %.** L'objectif de la Session 5+ est de faire passer
la couverture à 60 % en livrant les 🎯 T-011 → T-020.
