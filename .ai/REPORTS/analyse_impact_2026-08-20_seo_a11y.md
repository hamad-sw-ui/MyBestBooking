# Impact — T-017 : SEO + a11y + `next/font` + error/not-found + CSP

- **Date** : 2026-08-20 · **Niveau** : **S** · **Ref** : §14

## Quoi
- **Fonts** : migrer Inter + Poppins de `<link>` vers `next/font/google`.
- **SEO metadata** : `generateMetadata` sur `/`, `/hebergement/[slug]`,
  `/recherche`, `/aide`, `/bestrewards`. OpenGraph + Twitter Card.
- **`sitemap.ts`** + **`robots.ts`** dans `src/app/`.
- **Schema.org** : `Hotel` sur `/hebergement/[slug]`.
- **`error.tsx`** global + **`not-found.tsx`** custom + **`loading.tsx`**
  au niveau root.
- **A11y** : ajouter `aria-label` aux boutons icône-seul (~35 dans le
  header + le menu utilisateur + les cartes).
- **CSP** : `Content-Security-Policy` dans `next.config.ts` avec un
  nonce dev-safe (`'unsafe-inline'` pour l'instant, restreignable
  ultérieurement).
- Corriger le bouton dashboard/settings "Enregistrer" (soit brancher
  soit retirer pour ne plus déclencher R15).

## Où
- `src/app/layout.tsx` : `next/font`, retire le `<link>` Google Fonts.
- Nouveau : `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/error.tsx`,
  `src/app/not-found.tsx`, `src/app/loading.tsx`.
- `src/app/(main)/hebergement/[slug]/page.tsx` : `generateMetadata`
  + JSON-LD.
- `src/app/(main)/recherche/page.tsx`, `/aide/page.tsx`,
  `/bestrewards/page.tsx` : `metadata` static.
- `src/components/layout/header.tsx` : ajout `aria-label`.
- `next.config.ts` : CSP.
- `src/app/dashboard/settings/page.tsx` : neutralise le bouton
  "Enregistrer" (page purement présentationnelle, tag "en construction")
  ou le retire.

## Pourquoi
Débloque PAR-008 (a11y). Améliore SEO. Ferme le dernier item R15.
FEATURES.md sections SEO/a11y/UX passent en ✅.

## Contrat public
- Metadata nouvelles → aucun impact fonctionnel.
- CSP restrictive : peut casser un `<script>` inline non nonce si
  ajouté ultérieurement. `'unsafe-inline'` conservé sur `style-src`
  (Tailwind + inline styles) et `script-src` pour ne pas casser
  Turbopack en dev.

## Sécurité
Amélioration : CSP + Permissions-Policy déjà en place complètent
la posture headers.

## Test
Manuel ▶️ : `curl -I /` retourne CSP. `curl /sitemap.xml`. Lecture
d'une fiche property → JSON-LD dans le HTML.

## Rollback
`git revert`.
