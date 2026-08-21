# 🏨 MyBestBooking — présentation du projet

## Identité

| Élément | Valeur |
|---|---|
| Nom du produit | **mybestbooking** |
| Slogan | *« Réservez mieux. Voyagez plus. »* |
| Dépôt | `hamad-sw-ui/MyBestBooking` |
| Branche de travail active | `arena/01a01eee-mybestbooking` |
| Type d'application | Plateforme web de réservation d'hébergements (OTA) |
| Langue de l'interface | Français |
| Devise / marché par défaut | EUR — l'app est multi-devise et multi-pays au niveau du modèle |
| Nom du package `package.json` | `nextjs-postgresql-template` (hérité du template Arena, sans conséquence fonctionnelle) |

## À quoi ça sert

MyBestBooking permet à un **voyageur** de :

- rechercher un hébergement par ville / dates / voyageurs,
- consulter une fiche hébergement (photos, chambres, avis, politique d'annulation),
- réserver et payer une chambre (tunnel multi-étapes),
- gérer ses réservations, favoris, messages avec l'hôte,
- accumuler des points fidélité **BestRewards** (3 niveaux),
- déposer un avis vérifié après séjour.

Et à un **hôte** (professionnel ou particulier) de :

- publier et gérer des hébergements et des chambres,
- fixer disponibilités, prix, plans tarifaires et promotions,
- suivre ses réservations, ses revenus, ses avis,
- communiquer avec ses clients depuis un dashboard dédié.

Un rôle **admin** ouvre en plus la validation des annonces, la gestion des
utilisateurs et le monitoring global.

## Modèle de revenus (au niveau du code)

- **Commission par réservation**, taux stocké par hébergement (`properties.commissionRate`, défaut 15 %).
- Champs `subtotal`, `taxes`, `fees`, `discount`, `total`, `commissionAmount`,
  `netToHost` calculés côté serveur à la création de `bookings`.
- Programme fidélité **BestRewards** : niveau qui monte automatiquement à partir
  du compteur `bestrewardsBookingsCount` (seuils 5 et 15 dans le code).

## Public visé

- **Voyageurs francophones** : hôtels, riads, villas, appartements, campings…
- **Hôteliers et loueurs indépendants** cherchant une plateforme francophone
  légère.
- Portée géographique du seed : France, Maroc, Espagne, Italie, Tunisie —
  mais le modèle est international (codes ISO pays, devises, fuseaux).

## Stack technique

| Domaine | Choix |
|---|---|
| Runtime | Node.js (Next.js 16.2.6 — App Router, React 19) |
| Langage | TypeScript en mode `strict` |
| UI | React Server Components + Client Components ciblés, TailwindCSS 4 |
| Icônes | `lucide-react` |
| DB | PostgreSQL |
| ORM | Drizzle ORM (`drizzle-orm` + `drizzle-kit`), driver `pg` |
| Validation | Zod |
| Auth | JWT `jose` (HS256, 30 j) + cookie HTTP-only + table `sessions` |
| Hachage mots de passe | `bcryptjs` (coût 12) |
| Fonts | Google Fonts (Inter + Poppins) via `<link>` |
| Lint | ESLint 9 flat config + `eslint-config-next/core-web-vitals` |

## Statut actuel

Projet en **prototype fonctionnel avancé** :

- Toutes les surfaces UI principales existent (accueil, recherche, fiche,
  tunnel de réservation, compte, favoris, messages, BestRewards, aide, +13
  pages dashboard).
- Toutes les tables métier sont modélisées.
- Le paiement est **mocké** (`paymentStatus` forcé à `"paid"` à la création).
- Pas de tests automatisés.
- Pas encore de migrations Drizzle versionnées commitées.

## Glossaire

| Terme | Sens dans ce projet |
|---|---|
| **Property** | Hébergement (hôtel, riad, villa, appartement, camping, etc.) |
| **Room** | Type de chambre / unité louable rattachée à une property |
| **Rate plan** | Plan tarifaire (petit-dej inclus ou non, remboursable ou non…) |
| **Booking** | Réservation confirmée, référence `MBB-YYYY-XXXXXX` |
| **Host** | Utilisateur avec rôle `host`, propriétaire d'au moins une property |
| **BestRewards** | Programme de fidélité interne, 3 niveaux |
| **Wishlist** | Liste de favoris d'un utilisateur, partageable via `shareToken` |
