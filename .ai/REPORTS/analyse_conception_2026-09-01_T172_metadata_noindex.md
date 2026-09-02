# Analyse de conception — T-172 métadonnées localisées + noindex

- **Date** : 2026-09-01
- **Tâche** : T-172 (niveau S)

## Problème

L'audit d'exécution (crawl réel, `audit_execution_2026-09-01_T172_uit.md`)
montre 11 pages sans métadonnées propres : titres d'onglet génériques,
clés `search.meta.*` orphelines, et surtout **absence de `noindex`** sur les
zones à données personnelles (`/mon-compte`, `/mes-reservations`,
`/mes-favoris`, `/messages`, `/reservation`, `/dashboard/*`).

## Contraintes

- Next 16 : `generateMetadata` n'est exportable que depuis un **Server
  Component** ; 6 pages cibles sont des composants client (`useState`,
  `useSearchParams`, `useEffect`).
- Interdiction de casser l'existant : formulaires auth (soumission,
  Suspense/searchParams), page compte (tabs, mutations fetch).
- Convention maison (T-162) déjà éprouvée : wrapper serveur `page.tsx` +
  logique client dans `*-form.tsx`/`*-client.tsx` (cf. `/reservation`).

## Design retenu

1. **Pages déjà serveur** (`recherche`, `mes-favoris`, `mes-reservations`,
   `messages`, `messages/[id]`, `avis/[id]`, `verifier-email`) : ajout
   direct d'un `generateMetadata` localisé via `getServerLocale()` +
   `makeT()` — même pattern que `aide`/`bestrewards`.
2. **Pages client** : déplacement octet-pour-octet du composant dans
   `<nom>-client.tsx` (même dossier, non routable) ; `page.tsx` devient un
   wrapper serveur de ~20 lignes (metadata + rendu). Aucun import externe
   ne référençait ces pages (routes) → zéro propagation.
3. **Politique robots** :
   - publiques marketing (`/`, `/recherche`, fiches, auth login/register) :
     indexables — titres/descriptions localisés ;
   - utilitaires à jeton (`reinitialiser`, `activer-compte`,
     `verifier-email`, `mot-de-passe-oublie`) et privées
     (compte/réservations/favoris/messages/tunnel) : `index:false,
     follow:false` ;
   - `/dashboard/*` : `robots` posé une fois dans le layout (héritage).
4. **Cohérence locales** : défaut `supportedLocales` réduit à `[fr, en]`
   (le schéma tolère toujours « ar » pour compat ascendante).
5. **Clés** : 10 nouvelles clés `*.meta.*` dédiées (convention T-162) —
   1406 → **1416**, parité FR/EN assurée par le typage
   `Record<UiStringKey, string>` et le test de parité.

## Alternatives écartées

- Métadonnées statiques `export const metadata` : non localisables → rejeté.
- noindex via proxy/headers : moins explicite, non visible dans le code de
  page → réservé au cas wishlists (T-163).
- Renommer/réécrire les composants client : risque de régression inutile →
  copies conformes.
