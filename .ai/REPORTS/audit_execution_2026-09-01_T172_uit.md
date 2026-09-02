# 🔍 Audit d'exécution profond — scénarios & éléments fonctionnels (T-172)

- **Date** : 2026-09-01
- **Méthode** : exécution réelle — PostgreSQL embarqué (`npm run db:dev`),
  `drizzle-kit push`, seed démo (`POST /api/seed`), serveur Next dev
  `:3000`, sondes HTTP (crawl pages publiques/privées × rôles, FR/EN,
  paramètres aberrants), revue statique croisée (`useT`, garde-fous
  R15/R18/R19, TODO/FIXME, clés orphelines).
- **Portée** : pages, titres/SEO, boutons, liens, formulaires, tunnel de
  réservation, messagerie, favoris, alertes prix, RBAC, e-mails, API.

## 1. Ce qui a été éprouvé sans reproche (preuves d'exécution)

| Sonde | Résultat |
|---|---|
| 10 pages publiques FR (`/`, `/recherche`, `/bestrewards`, `/aide`, `/confidentialite`, `/mentions-legales`, `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/maintenance`) | 200 + `lang=fr` + titres corrects |
| Bascule EN `?lang=` → cookie → navigation **sans** paramètre | `/`, `/recherche`, `/connexion` servis `lang=en`, cookie dual posé |
| Login customer/admin, 10 pages privées + dashboard × 10 | 200 ; customer → `/dashboard` **307** (RBAC) |
| Fiche hébergement réelle | 200 |
| Routes inexistantes / partage wishlist invalide | **404 réel** |
| Slug hébergement inexistant | contenu « Hébergement introuvable » + `noindex` (soft-404 streamé, limitation Next 16 documentée KNOWN_LIMITATIONS) |
| `/reservation` sans paramètres / `roomId=abc` | état gracieux « Informations de réservation manquantes » (pas de crash) |
| Recherche paramètres aberrants (`minPrice>maxPrice`, dates passées, `guests=abc`, amenity inconnue) | 200 silencieux (comportement absorbant, pas de 500) |
| Messages API en locale EN (cookie) | « Incorrect email or password », « Invalid or missing value » — mapping T-170 effectif |
| Garde-fous framework | R15 (boutons↔fetch) / R18 (UI morte) / R19 (liens) : 0 violation |
| Smoke officiel | **94/94** — dont réservation confirmée 201 `MBB-…` |

## 2. Problèmes confirmés (avant correction)

### P1 — Métadonnées inachevées : 11 pages sans `generateMetadata`

- **`/recherche`** : les clés `search.meta.title/description` existaient
  (T-162) mais **n'étaient branchées nulle part** → page SEO cœur du site
  servie avec le titre générique « MyBestBooking — Réservez mieux… »,
  FR comme EN. Clés orphelines = travail entamé non fini.
- **6 pages auth** (`connexion`, `inscription`, `mot-de-passe-oublie`,
  `reinitialiser`, `verifier-email`, `activer-compte`) : idem — onglet sans
  titre descriptif.
- **Pages privées** (`mon-compte`, `mes-reservations`, `mes-favoris`,
  `messages`, `messages/[id]`, `avis/[id]`, `reservation`) : non seulement
  titre générique, mais **aucune directive `noindex`** → pages à données
  personnelles (montants, conversations, favoris) déclarées indexables.
- **`/dashboard/*`** : aucune directive robots — zone hôte/admin privée.

### P2 — Façade `supportedLocales` : « ar » annoncé mais non servi

`/api/app-preferences` renvoyait `supportedLocales: ["fr","en","ar"]`
(défaut `settings.ts`) alors que toute la chaîne (UiLocale = fr|en,
dictionnaires, e-mails, SSR) retombe en français pour « ar ». Le panneau
admin ne propose déjà plus « ar » (T-145) : le défaut persisté était
resté incohérent avec cette décision.

### P3 — Faux positifs écartés (explicitement non « corrigés »)

- Message API en français avec compte dont `language=fr` malgré cookie `en`
  → **règle de priorité voulue** (compte > cookie, T-152).
- Soft-404 HTTP 200 + `noindex` sur routes dynamiques → limitation Next.js
  streamée documentée (T-153 D).
- Erreurs FR remontant dans le panneau admin : cycle admin hors vague i18n
  (sauf résidus corrigés à la session précédente).

## 3. Remédiation appliquée (T-172, niveau S — additif)

1. `recherche/page.tsx` : `generateMetadata` branché sur les clés
   `search.meta.*` (orphan keys désormais câblées).
2. Wrappers serveur `page.tsx` + composants `*-client.tsx` (pattern T-162
   déjà éprouvé pour `/reservation`) : `connexion/login-client`,
   `inscription/register-client`, `mot-de-passe-oublie/forgot-client`,
   `reinitialiser/reset-client`, `activer-compte/claim-client`,
   `mon-compte/account-client`. Titres localisés via nouvelles clés
   `auth.meta.*Title` / `account.meta.title`.
3. Pages privées serveur (`mes-favoris`, `mes-reservations`, `messages`,
   `messages/[id]`, `avis/[id]`) et wrapper `mon-compte` : titre localisé +
   `robots: { index:false, follow:false }`. `reservation/page.tsx` :
   ajout du `noindex` à la metadata existante. `verifier-email` (serveur) :
   titre + noindex.
4. `dashboard/layout.tsx` : `metadata.robots` noindex/nofollow hérité par
   tout `/dashboard/*` (titres de page inchangés).
5. `settings.ts` : défaut `supportedLocales: ["fr","en"]` (schéma Zod
   inchangé — « ar » reste lisible pour données historiques ; aucune
   migration, aucun consommateur cassé : seul `/api/app-preferences`
   exposait la valeur).
6. Dictionnaire : +10 clés FR/EN (`auth.meta.*` ×6, `account.meta.title`,
   `bookings.meta.title`, `fav.meta.title`, `messages.meta.title`) →
   catalogue **1416** clés, parité garantie par typage + test.

## 4. Non-régression démontrée

- Pages publiques marketing (`/`, `/recherche`, fiche…) **sans** noindex,
  contenu identique (seuls `<title>`/`<meta name=description>` ajoutés).
- Comportement FR par défaut strictement inchangé.
- `useSearchParams`/`Suspense` des pages client déplacés tels quels
  (copie octet par octet du composant, seul le point d'entrée change).
- Aucune évolution de contrat API ; `supportedLocales` reste consommable
  avec « ar » si des données persistées l'emploient encore.

Preuves chiffrées : voir `validation_T-172_2026-09-01.md`.
