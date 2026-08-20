# 🎯 TÂCHE EN COURS

> **Une seule tâche autorisée à la fois.** Toute autre modification en dehors
> du périmètre décrit ici est **refusée**, sauf validation explicite du
> responsable ou tâche de niveau **T** (trivial) documentée en fin de session.

---

## Identifiant

- **ID** : B-000
- **Titre** : Mise en place du framework de gouvernance `.ai/` v1.0.0
- **Niveau de proportionnalité** : **S** (Structurant)
- **Assigné à** : Arena Agent Mode
- **Ouverte le** : 2026-08-20

## Contexte

Le dossier `.ai/` a d'abord été réécrit en mode « aide-mémoire non
bloquant » (commit `4ad8884`). Le responsable a demandé de le transformer en
**vrai framework de gouvernance hybride** (proportionnalité T/L/S/C,
checklists bloquantes, `STATE.md`, `CURRENT_TASK.md`, `TRACEABILITY.md`,
règles §13/§14/§16/§22, ADR obligatoires pour S/C, tags de preuve).

## Objectif

Livrer un `.ai/` conforme au manifest suivant :

- Couche contenu conservée (PROJECT, ARCHITECTURE, DATABASE, API, UI,
  SECURITY, CODING_STYLE, DEV_ENVIRONMENT, DEPENDENCIES, ROADMAP, BUGS,
  BACKLOG, DEVLOG).
- Couche gouvernance ajoutée : MISSION, INDEX, STATE, CURRENT_TASK,
  CODING_RULES, TRACEABILITY, TEST_PLAN, KNOWN_LIMITATIONS,
  PROCESS_IMPROVEMENTS, PROGRESS, framework.manifest.json.
- Checklists rendues **bloquantes** (avant_commit, avant_pull_request,
  avant_release).
- Prompts complétés (rôles multiples, session_start durci).
- READMEs des dossiers ADR/REPORTS/LOGS remis à jour pour refléter le
  caractère **obligatoire pour S et C**.

## Périmètre autorisé

- ✅ Créer / modifier des fichiers **uniquement** dans `.ai/`.
- ✅ Committer sur `arena/01a01eee-mybestbooking`.
- ❌ **Ne pas toucher** au code applicatif (`src/`, `package.json`,
  `next.config.ts`, `drizzle.config.json`).
- ❌ **Ne pas modifier** le schéma DB.
- ❌ **Ne pas ouvrir** de PR sans validation.

## Analyse d'impact (obligatoire pour S)

Voir `REPORTS/analyse_impact_2026-08-20_governance_setup.md`.

## Conception (obligatoire pour S)

Voir `REPORTS/analyse_conception_2026-08-20_governance_setup.md`.

## Critères d'acceptation

- [x] Tous les documents obligatoires du `framework.manifest.json` existent.
- [x] `INDEX.md` prescrit un ordre de lecture cohérent.
- [x] `CODING_RULES.md` contient les §13, §14, §15, §16, §17, §22.
- [x] `TRACEABILITY.md` ouvre un tableau vide prêt à recevoir des entrées.
- [x] `STATE.md` reflète l'état réel du dépôt au 2026-08-20.
- [x] `CHECKLISTS/*` sont marquées **bloquantes** et non plus facultatives.
- [x] `PROMPTS/roles.md` liste les 11 rôles techniques web.
- [x] Un ADR ADR-001 acte le choix du framework.
- [x] Un rapport d'analyse d'impact et un rapport de conception existent
  dans `REPORTS/`.
- [x] `PROGRESS.md` ouvre une entrée horodatée pour cette session.
- [x] Commit atomique portant uniquement `.ai/`.

## Statut

**CORRIGÉ (INSPECTION)** — livrable produit, non validé par exécution car il
s'agit de documentation (pas de code à typechecker/builder/tester).

## Prochaine tâche recommandée

- **B-001** : `JWT_SECRET` obligatoire au boot (niveau **C** — sécurité auth).
  → nécessite analyse d'impact + conception + débat multi-rôles + double
  validation.

---

**Rappel** : quand cette tâche est clôturée par le responsable, remplacer
l'intégralité de ce fichier par la description de la tâche suivante. Ne
jamais laisser deux tâches ouvertes ici en même temps.
