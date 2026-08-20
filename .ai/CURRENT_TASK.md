# 🎯 TÂCHE EN COURS

> **Une seule tâche autorisée à la fois.** Toute autre modification en dehors
> du périmètre décrit ici est **refusée**, sauf validation explicite du
> responsable ou tâche de niveau **T** (trivial) documentée en fin de session.

---

## Identifiant

- **ID** : B-000 v1.1
- **Titre** : Auto-audit + ajustements du framework `.ai/` v1.0.1
- **Niveau de proportionnalité** : **S** (Structurant)
- **Assigné à** : Arena Agent Mode
- **Ouverte le** : 2026-08-20 (Session 3)
- **Prédécesseur** : B-000 v1 (mise en place initiale v1.0.0, commits
  `4ad8884` + `455c121`)

## Contexte

À la demande du responsable de valider/ajuster la mise en place initiale,
un auto-audit a été mené qui a détecté **10 défauts** (voir
`REPORTS/audit_2026-08-20_framework_v1.0.0.md`). Les décisions du
responsable ont fixé le périmètre de cette version 1.0.1 :

- Corriger les **4 défauts rouges** (contradictions internes objectives).
- **Assumer le niveau S** pour B-000, documenter la justification dans
  ADR-001.
- Ajouter une **clause transitoire §13.4** : test manuel ▶️ documenté vaut
  preuve tant que `TEST_PLAN.md → J1` n'est pas livré.
- Créer `scripts/check-ai.mjs` + `npm run ai:check`, tranché par
  **ADR-002** (le framework peut produire du code de vérification hors de
  `.ai/`).

## Objectif

Livrer la version **1.0.1** du framework avec :

1. `STATE.md` cohérent avec le HEAD Git courant.
2. `framework.manifest.json → reading_order` aligné sur `INDEX.md`
   (8 documents, `framework.manifest.json` inclus).
3. `PROMPTS/roles.md` libellé du rôle 7 aligné sur le manifest.
4. `CURRENT_TASK.md` (ce fichier) avec tags §16 sur les critères
   d'acceptation.
5. `CODING_RULES.md §13.4` amendé avec la clause transitoire.
6. `ADR-001` complété d'une section « Niveau assumé S : justification ».
7. `ADR-002_Automatisation_hors_dossier_ai.md` créé.
8. `scripts/check-ai.mjs` créé + entrée `npm run ai:check` dans
   `package.json`.
9. `README.md` racine ajouté à `mandatory_documents`.
10. `PROCESS_IMPROVEMENTS.md` mis à jour avec l'audit et les décisions.
11. `PROGRESS.md` ouvre une nouvelle entrée Session 3.
12. `TRACEABILITY.md` référence les nouveaux artefacts.
13. `npm run ai:check` **passe** (▶️ preuve d'exécution requise pour
    clôturer VALIDÉ).

## Périmètre autorisé

- ✅ Modifier tout `.ai/`.
- ✅ Créer `scripts/check-ai.mjs`.
- ✅ Modifier `package.json` (ajout scripts uniquement, aucune dépendance
  runtime).
- ✅ Committer sur `arena/01a01eee-mybestbooking`.
- ❌ **Ne pas toucher** au code applicatif `src/`.
- ❌ **Ne pas modifier** le schéma DB.
- ❌ **Ne pas ouvrir** de PR sans validation.

## Analyse d'impact (§14)

Voir `REPORTS/audit_2026-08-20_framework_v1.0.0.md` (l'audit lui-même
tient lieu d'analyse d'impact pour cette itération corrective).

## Conception (§15.1)

- **ADR-001** actualisé — assume le niveau S pour la mise en place
  initiale.
- **ADR-002** — tranche la question de l'automatisation hors `.ai/`.

## Critères d'acceptation

Chaque critère porte un **tag de preuve §16**. Un critère `[x]` sans tag
▶️/🔨/🧪 est considéré comme mensonger (§16, §22).

- [ ] 🔨 `npm run ai:check` passe sans erreur — **preuve principale, seule
  qui autorise le passage à `VALIDÉ`**
- [ ] 🔍 `STATE.md → HEAD` référence le SHA du commit courant (à mettre à
  jour juste avant commit final)
- [ ] 🔍 `framework.manifest.json → reading_order` contient les 8
  documents de `INDEX.md`
- [ ] 🔍 `PROMPTS/roles.md § rôle 7` est libellé « Expert sécurité web
  (auth, cookies, CSP) »
- [ ] 🔍 `CURRENT_TASK.md` (ce fichier) : chaque critère porte un tag §16
- [ ] 🔍 `CODING_RULES.md §13.4` inclut la clause transitoire de preuve
  manuelle
- [ ] 🔍 `ADR-001` contient une section « Niveau assumé S : justification »
- [ ] 🔍 `ADR-002_Automatisation_hors_dossier_ai.md` existe
- [ ] 🔍 `scripts/check-ai.mjs` existe et est exécutable
- [ ] 🔍 `package.json → scripts.ai:check` existe
- [ ] 🔍 `README.md` figure dans `mandatory_documents`
- [ ] 🔍 `PROCESS_IMPROVEMENTS.md` a une entrée « Session 3 — auto-audit »
- [ ] 🔍 `PROGRESS.md` a une entrée « Session 3 »
- [ ] 🔍 `TRACEABILITY.md` référence B-000 v1.1

## Statut

**CORRIGÉ (INSPECTION)** — tant que `npm run ai:check` n'a pas été exécuté
avec succès ▶️ et le résultat consigné dans `TRACEABILITY.md`, la tâche
reste en INSPECTION (§13).

Passage à **CORRIGÉ (VALIDÉ)** possible seulement quand :

- ▶️ `npm run ai:check` retourne code 0 dans une exécution horodatée
  documentée ;
- 🔍 tous les critères ci-dessus sont vérifiables ;
- 🔍 le responsable a explicitement validé (le framework n'autorise pas
  l'auto-validation §22).

## Prochaine tâche recommandée

Après clôture VALIDÉ de B-000 v1.1 → **B-001** : `JWT_SECRET` obligatoire
au boot (niveau **C** — première tâche déclenchant analyse d'impact
complète + conception + débat multi-rôles 11 rôles + double validation).

---

**Rappel** : quand cette tâche est clôturée par le responsable, remplacer
l'intégralité de ce fichier par la description de la tâche suivante. Ne
jamais laisser deux tâches ouvertes ici en même temps.
