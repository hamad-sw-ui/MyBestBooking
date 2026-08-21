# 🎨 Interface utilisateur

## Charte graphique

Définie dans `src/app/globals.css` (tokens `@theme` Tailwind v4) :

| Rôle | Couleur | Hex |
|---|---|---|
| Primaire (marine) | `--color-primary` | `#1B3A6B` |
| Secondaire (rouge corail) | `--color-secondary` | `#FF5A5F` |
| Accent (or) | `--color-accent` | `#F5A623` |
| Succès | `--color-success` | `#00A699` |
| Danger | `--color-danger` | `#D93025` |

Logo : `✦ mybest booking` — l'étoile est en `#F5A623`, `mybest` en primaire,
`booking` en secondaire.

## Typographie

- **Interface** : `Inter` (400/500/600/700) chargée via `<link>` Google Fonts
  dans `src/app/layout.tsx`.
- **Titres marketing** : `Poppins` (600/700), appliquée inline via
  `style={{ fontFamily: "'Poppins', sans-serif" }}` sur les grands `<h1>`/`<h2>`.

À terme : basculer sur `next/font` pour la perf.

## Design system interne (`src/components/ui/`)

| Composant | Fichier |
|---|---|
| `Button` (variants + tailles) | `button.tsx` |
| `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` | `card.tsx` |
| `Input`, `Textarea`, `Select` | `input.tsx` |
| `Badge` | `badge.tsx` |
| `Modal` | `modal.tsx` |
| `Skeleton` | `skeleton.tsx` |
| `EmptyState` | `empty-state.tsx` |
| `ToastProvider` + `useToast` | `toast.tsx` (monté dans root layout) |

Utilitaire `cn(...)` (`clsx` + `tailwind-merge`) exposé par `@/lib/utils`.

## Layouts

| Chemin | Rôle |
|---|---|
| `src/app/layout.tsx` | Racine : `<html lang="fr">`, fonts, `ToastProvider` |
| `src/app/(auth)/layout.tsx` | Écrans d'auth : logo centré + card centrée |
| `src/app/(main)/layout.tsx` | Voyageur : `Header` + `Footer`, récupère `user` en RSC |
| `src/app/dashboard/layout.tsx` | Pro : sidebar (desktop) + header mobile, redirects si rôle non autorisé |

## Cartographie des pages voyageur (`(main)`)

| Route | Fichier | Rôle |
|---|---|---|
| `/` | `app/page.tsx` | Accueil : hero + search box + populaires + destinations + valeurs |
| `/recherche` | `(main)/recherche/page.tsx` | Résultats + filtres |
| `/hebergement/[slug]` | `(main)/hebergement/[slug]/page.tsx` | Fiche property + rooms + avis |
| `/reservation?property=…&room=…` | `(main)/reservation/page.tsx` | Tunnel multi-étapes (client) |
| `/mes-reservations` | | Historique et statuts |
| `/mes-favoris` | | Wishlists |
| `/messages` | | Threads voyageur ↔ hôte |
| `/mon-compte` | | Profil, sécurité, préférences (421 l.) |
| `/bestrewards` | | Programme fidélité |
| `/aide` | | FAQ |
| `/connexion`, `/inscription` | `(auth)/…` | Auth |

## Cartographie du dashboard pro (`/dashboard/*`)

`page.tsx` (KPI + activité), `properties` (+ `[id]`, `new`), `rooms`,
`bookings` (+ `[id]`), `reviews`, `messages`, `promotions`, `analytics`,
`billing`, `users`, `settings`.

## Conventions UI

- Toutes les pages publiques et voyageur sont en **français** (labels codés en dur).
- **Icônes** systématiquement via `lucide-react`.
- Les couleurs de marque sont référencées via classes arbitraires Tailwind :
  `bg-[#1B3A6B]`, `text-[#FF5A5F]`, etc. (À terme : basculer sur les tokens
  Tailwind v4 `bg-primary` etc. déjà déclarés dans `globals.css`.)
- Boutons d'action principaux : rouge corail `#FF5A5F`.
- Boutons/menus secondaires : marine `#1B3A6B`.

## Points à améliorer

- **`<img>` HTML natif** partout au lieu de `next/image` (perf LCP, pas de
  redimensionnement automatique). Nécessitera d'ajouter les hôtes d'images dans
  `next.config.ts` → `images.remotePatterns` (unsplash.com, etc.).
- **`useSearchParams()` sans `<Suspense>`** dans `reservation/page.tsx` — Next
  16 peut le refuser au build.
- Pas de dark mode.
- Pas de `sr-only` sur plusieurs boutons icône-seul (a11y).
