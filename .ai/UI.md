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
| `Dialog` (accessible : `role=dialog`, `aria-modal`, piège de focus, Esc, retour du focus) | `dialog.tsx` (T-247) |
| `ShowMore` (fenêtre de liste : compteur, « Afficher N de plus », « Tout afficher ») | `show-more.tsx` (T-245) |
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
`billing`, `users`, `settings`, `audit`, `cron` (T-250, supervision des tâches
planifiées : état par tâche, compteurs, historique des exécutions).

Deux colonnes du dashboard pro sont directement actionnables :

- `/dashboard/users` — colonne « Hôte » : statut d'approbation, puis
  éditeur de commission (`HostCommissionEditor`, T-215) pour un hôte approuvé
  ou porteur d'un taux explicite : taux affiché ou « Hérite : {global} % »,
  crayon, impact « Héritent : N · Taux explicite : M », case de propagation
  aux hébergements sans taux propre (décochée par défaut).
- `/dashboard/bookings` — colonne « Statut » (T-216) : badge historique, plus
  un crayon ouvrant les transitions acceptées par le serveur
  (`pending → confirmed|cancelled`, `confirmed → cancelled|completed|no_show`,
  clôture seulement après le départ et paiement constaté). États terminaux et
  cas non couverts : badge seul, avec infobulle explicative.

### T-245 → T-250 — écrans modifiés (2026-09-11)

- **Fenêtre progressive (T-245)** : `/dashboard/bookings`, `/dashboard/users`,
  `/dashboard/reviews`, `/dashboard/properties`, `/dashboard/promotions` et
  `/mes-reservations` chargent **25 lignes** par défaut (au lieu de tout) et
  affichent le bandeau `ShowMore` : « N résultats affichés sur M », « Afficher 25
  de plus », « Tout afficher (M) », plafond 500 avec avertissement, et rappel
  que les filtres/tri/compteurs client portent sur les lignes affichées. Le
  paramètre `?limit=` est conservé dans les liens (les filtres `?status=` /
  `?payment=` aussi) et retiré au retour par défaut.
- **Motif de décision (T-247)** : masquer/refuser un avis, suspendre un compte ou
  rejeter une annonce passent par `ReasonDialog` (motif **obligatoire**, 0/500,
  bouton désactivé tant que le champ est vide) au lieu de `window.prompt`.
- **Favoris (T-246)** : le cœur propose « Choisir une liste » quand l'utilisateur
  en a plusieurs ; `/mes-favoris` ajoute « Déplacer vers une liste » sur chaque
  carte, et chaque liste est renommable (icône crayon dans `WishlistActions`).
- **Wallet (T-248)** : `/mon-compte` → « Historique des mouvements » (20 derniers
  mouvements, montant signé, solde après) sous le solde BestRewards.
- **Supervision (T-250)** : `/dashboard/cron` (lien de navigation admin) montre
  l'état de chaque tâche (`ok` / `overdue` / `failed` / `never ran`) et
  l'historique des exécutions.

### T-217 — écrans ajoutés ou corrigés (2026-09-10)

- `/dashboard/promotions/[id]` : édition d'un code promo (nom, date de fin,
  plafonds, actif) ; identité (code/type/valeur) en lecture seule.
- `/dashboard/rooms/[id]` : redirection serveur (307) vers
  `/dashboard/rooms/[id]/calendrier#room-edit` — l'édition d'unité reste sur la
  page calendrier, désormais accessible aussi par cette URL.
- `/dashboard/settings` : section « Avis » (bascule de modération préalable) +
  lien vers la file de modération.
- `/dashboard/audit` : bouton « Charger plus » (pagination API) et compteurs
  d'entrées chargées/filtrées.
- `/dashboard/billing` : carte renommée « Versements et relevés » + pointeur
  vers les reçus par réservation ; export « Export CSV (versements) ».
- `/dashboard/bookings` : export « Export CSV (réservations) » (T-219) — les deux
  exports ne partagent plus le même libellé.
- `/messages` : un fil encore vide (7 jours) affiche « Conversation ouverte —
  écrivez votre premier message ».
- `loading.tsx` **feuilles uniquement** (`components/page-loading.tsx`) :
  jamais de squelette au-dessus d'une route `[id]` (soft-404, BUG-051).

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
