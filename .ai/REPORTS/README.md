# 📊 RAPPORTS

Ce dossier contient les **modèles** de rapports et les **rapports datés**
produits au fil du projet.

## Convention de nommage

```
rapport_<type>_<AAAA-MM-JJ>.md
```

Exemples : `rapport_securite_2026-08-15.md`, `rapport_analyse_2026-09-02.md`.

## Modèles disponibles

| Modèle | Quand le produire |
|---|---|
| `MODELE_analyse_impact.md` | ⛔ **AVANT toute modification de code** (§14) |
| `MODELE_analyse_conception.md` | Niveaux S et C — après l'impact, avant le code (§15.1) |
| `MODELE_debat_technique.md` | Niveau C — 10 rôles, désaccords encouragés (§15.2) |
| `MODELE_opportunites.md` | Niveaux S et C — améliorations proposées, jamais imposées (§15.3) |
| `MODELE_analyse_impact_post_correction.md` | Après chaque correction importante — prévu vs. constaté |
| `MODELE_rapport_analyse.md` | Avant toute décision structurante ou refactor important |
| `MODELE_rapport_securite.md` | À chaque modification de crypto, permission, accès — et avant chaque release |
| `MODELE_rapport_performance.md` | Avant/après optimisation, ou en cas de lenteur signalée |
| `MODELE_rapport_couverture_tests.md` | À chaque jalon de la roadmap |
| `MODELE_rapport_architecture.md` | À chaque évolution structurelle (Hilt, découpage) |

## Rapports produits

| Date | Fichier | Type |
|---|---|---|
| 2026-07-28 | `rapport_analyse_2026-07-28_audit_initial.md` | Analyse — audit initial du dépôt |
| 2026-07-28 | `rapport_analyse_2026-07-28_sauvegarde_distante.md` | Analyse — Drive vs Dropbox (D2) |
| 2026-07-28 | `analyse_impact_2026-07-28_branchement_backupmanager.md` | **Analyse d'impact** — branchement `BackupManager` (B-101) |
| 2026-07-28 | `analyse_conception_2026-07-28_branchement_backupmanager.md` | **Conception** — 4 solutions comparées, C retenue |
| 2026-07-28 | `debat_technique_2026-07-28_branchement_backupmanager.md` | **Débat** — 10 rôles, 2 ❌ bloquants, BUG-024 découvert |
| 2026-07-28 | `opportunites_2026-07-28_sauvegarde.md` | **Opportunités** — 13 identifiées, 9 versées au backlog |

## Rapports générés automatiquement

Les rapports produits par la chaîne Docker (`rapport_compilation_*`,
`rapport_tests_*`, `rapport_validation_*`…) sont **horodatés et non versionnés**
(voir `.gitignore`). Seuls les modèles et les analyses rédigées à la main sont
suivis en Git.

## Règles

- Un rapport est **daté et figé** : on n'écrase jamais un rapport existant.
- Un rapport constate des **faits vérifiables**, pas des impressions.
- Si une mesure n'a pas pu être exécutée, l'écrire — ne jamais l'inventer.
- Tout rapport structurant est référencé depuis `PROGRESS.md`.
