# Analyse d'impact — T-175 feedbacks utilisateur des filtres de recherche

- **Date** : 2026-09-01
- **Tâche** : T-175
- **Niveau** : S (100 % additif — bandeau conditionnel + brique pure)

## Problème (prouvé à l'exécution)

`/recherche` écartait silencieusement des paramètres saisis : bornes de prix
inversées → « 0 résultat » trompeur ; dates inversées/passées → clause de
disponibilité abandonnée et résultats présentés comme valides ;
`guests=abc` → filtre voyageurs ignoré. Rapport complet :
`audit_execution_2026-09-01_T175_feedbacks_filtres.md`.

## Surface impactée

- `src/lib/search-warnings.ts` (nouveau, pur — 0 io) :
  `searchFilterWarnings()` + `SEARCH_WARNING_KEY` (mapping type-safe).
- `src/app/(main)/recherche/page.tsx` : calcul + bandeau `role="alert"`
  au-dessus des résultats (uniquement si warnings).
- `src/lib/ui-strings.ts` : +4 clés `search.warn.*` FR/EN (**1420**) ;
  reformulation du titre d'état réservation (« manquantes ou invalides »).
- `src/lib/search-warnings.test.ts` (nouveau, 7 tests) ;
  `src/lib/ui-strings.test.ts` (compteur 1416→1420).

## Risques & garde-fous

- Régression du moteur : **impossible** — la brique est en lecture seule,
  `searchProperties` n'est pas appelée différemment, aucune clause SQL
  modifiée.
- Faux positifs du bandeau : règles du moteur répliquées dans la brique
  (format date, ordre, bornes converties en devise de stockage, entier
  guests) — couvertes par 7 tests unitaires.
- Clés i18n : parité garantie par typage + test dédié (chaque warning a
  FR≠EN non vide).
- SSR : bandeau rendu serveur, aucune hydratation ajoutée.

## Preuves attendues

tsc · eslint · vitest complet · build prod · smoke 94 · probes curl des 4
cas FR/EN + cas sain sans bandeau · ai:check.
