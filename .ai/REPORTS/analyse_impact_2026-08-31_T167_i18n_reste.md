# Analyse d'impact — T-167 i18n restes public + privé

- Date : 2026-08-31
- Tâche : T-167
- Niveau : S (structurant, additif, aucun contrat API cassé)
- Surface impactée :
  - Dictionnaire `src/lib/ui-strings.ts` (clés FR/EN ajoutées)
  - Provider client `src/components/ui-locale-provider.tsx` (SSR locale)
  - Auth `(auth)/*`, layout auth, error/loading/maintenance, skip-link
  - Compte voyageur + composants associés
  - Messages voyageur
  - Restes `mes-reservations`, métadonnées recherche, 404 partage
  - Chrome dashboard (home + titres de listes)
- Risques :
  - Flash FR au SSR si un client ignore `initialLanguage` — mitigé par le provider racine
  - Clés manquantes FR/EN → test `ui-strings.test.ts` (mêmes clés)
  - Confirmation suppression compte : mot localisé (`SUPPRIMER`/`DELETE`)
- Preuves attendues : tsc, lint, `ui-strings` tests, i18n:check (baisse des hits auth/compte)
- Plan de non-régression : pages auth FR inchangées par défaut ; cookie `en` → libellés EN
