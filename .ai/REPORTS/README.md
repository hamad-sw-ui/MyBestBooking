# REPORTS

**Obligatoire pour tout changement de niveau S ou C.** Facultatif pour L,
interdit (pas de valeur) pour T.

Contenu attendu :

- `analyse_impact_<date>_<sujet>.md` — répond aux 9 questions de
  `CODING_RULES.md` §14.
- `analyse_conception_<date>_<sujet>.md` — plan de conception §15.1
  (options, retenu, alternatives écartées, migration).
- `debat_technique_<date>_<sujet>.md` — débat 11 rôles §15.2 pour tout
  niveau **C** (ou **S** en cas de désaccord).
- `opportunites_<date>_<sujet>.md` — opportunités d'amélioration adjacentes
  identifiées pendant la tâche.
- `rapport_analyse_<date>_<sujet>.md` — audits ponctuels (perf, sécurité,
  couverture).

## Nommage

`<type>_<YYYY-MM-DD>_<slug>.md`. La date est celle de rédaction, jamais
antérieure au commit associé.

## Discipline

Un rapport est **daté**, **signé** (auteur + éventuellement responsable),
et référencé depuis :

- `TRACEABILITY.md` (si le rapport prouve la clôture d'un item) ;
- `PROGRESS.md` (dans l'entrée de la session correspondante) ;
- l'ADR concerné (si applicable).

Un rapport orphelin (non référencé, non daté) est **supprimé** en
rétrospective §17. Un rapport de niveau S ou C manquant **bloque** la
clôture de la tâche (`framework.manifest.json → blocking_rules →
missing_impact_analysis_for_S_or_C`).

## Registre

| Date | Type | Sujet | Tâche |
|---|---|---|---|
| 2026-08-20 | analyse_impact | governance_setup | T-000 |
| 2026-08-20 | analyse_conception | governance_setup | T-000 |
| 2026-08-23 | rapport_analyse | parcours fonctionnels runtime | audit produit |
