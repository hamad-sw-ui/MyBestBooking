# Analyse d'impact — T-172 métadonnées localisées + noindex zones privées

- **Date** : 2026-09-01
- **Tâche** : T-172
- **Niveau** : S (structurant, 100 % additif — métadonnées et wrappers, aucun
  comportement métier modifié)
- **Surface impactée** :
  - `src/app/(main)/recherche/page.tsx` (+generateMetadata)
  - `src/app/(main)/{mes-favoris,mes-reservations,messages,messages/[id],mes-reservations/avis/[id]}/page.tsx` (+generateMetadata noindex)
  - Wrappers serveur + `*-client.tsx` : `(auth)/{connexion,inscription,mot-de-passe-oublie,reinitialiser,activer-compte}`, `(main)/mon-compte`
  - `src/app/(main)/reservation/page.tsx` (+robots noindex)
  - `src/app/dashboard/layout.tsx` (+metadata robots noindex hérité)
  - `src/lib/ui-strings.ts` (+10 clés FR/EN), `src/lib/ui-strings.test.ts` (compteur 1416)
  - `src/lib/settings.ts` (défaut `supportedLocales` fr/en)
- **Risques** :
  - Wrapper client/serveur mal découpé → échec de build (couvert par
    `tsc` + `next build` + probes runtime).
  - `noindex` propagé à une page publique par erreur → vérifié page par page
    (accueil/recherche/fiche restent indexables).
  - Clé i18n manquante → impossible : `Record<UiStringKey, string>` typé à
    la compilation + test de parité FR/EN.
  - `supportedLocales` consommé ailleurs → grep exhaustif : seul
    `/api/app-preferences` l'expose ; pas de test l'assertant.
- **Plan de non-régression** : tsc + eslint + vitest complet (DB comprise),
  build prod, smoke 94 assertions, probes curl (titres FR/EN + noindex par
  page + `/api/app-preferences`), garde-fous i18n/ai:check.
