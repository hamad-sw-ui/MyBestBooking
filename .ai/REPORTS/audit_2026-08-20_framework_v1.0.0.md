# Audit du framework `.ai/` v1.0.0

- **Date** : 2026-08-20 (Session 3)
- **Auteur** : Arena Agent Mode (auto-audit à la demande du responsable)
- **Objet** : Valider/ajuster la mise en place initiale du framework
  (commits `4ad8884` + `455c121`).
- **Tâche déclenchée** : T-000 v1.1

---

## Méthode

Vérifications automatisées (grep, python, `git rev-parse`, comparaison
JSON ↔ Markdown) sur le HEAD `455c121`. Aucune modification pendant
l'audit.

## Résultats

**10 défauts identifiés**, classés par gravité.

### 🔴 Défauts rouges — contradictions internes objectives

| # | Défaut | Preuve (§16) | Correction v1.0.1 |
|---|---|---|---|
| 1 | `STATE.md` référence HEAD `4ad8884`, HEAD réel `455c121`. Auto-violation de la règle `mismatched_git_state`. | 🔍 `git rev-parse --short HEAD` = `455c121` ; grep sur STATE.md | STATE.md pointe désormais sur `455c121` et signale explicitement qu'il sera mis à jour en fin de session. Vérification mécanique via R7 de `check-ai.mjs`. |
| 2 | `INDEX.md` liste 8 documents en ordre de lecture, `manifest.reading_order` en liste 7 (manque `framework.manifest.json`). | 🔍 comparaison | `reading_order` étendu à 8 documents. R4 de `check-ai.mjs`. |
| 3 | Libellé rôle 7 différent : manifest = « Expert sécurité web (auth, cookies, CSP) », `roles.md` = « Expert sécurité web ». | 🔍 comparaison | Libellé uniformisé au long. R5 de `check-ai.mjs`. |
| 4 | `CURRENT_TASK.md` : 11 critères d'acceptation cochés `[x]` **sans tag §16**. Violation directe de §16. | 🔍 grep | Réécriture complète de `CURRENT_TASK.md`, chaque critère porte un tag 🔍/▶️. |

### 🟠 Fragilités conceptuelles

| # | Défaut | Décision responsable | Application |
|---|---|---|---|
| 5 | T-000 s'auto-valide (auteur = validateur). | Assumé : validation par le responsable = preuve de clôture. | `CURRENT_TASK.md` exige désormais explicitement la validation du responsable pour passer à `VALIDÉ`. |
| 6 | Niveau T-000 = S discutable (modifie les règles opposables). | **Garder S**, documenter la justification dans ADR-001. | ADR-001 complété d'une section « Niveau assumé S : justification » (4 arguments : périmètre docs, rollback trivial, aucune règle antérieure à défendre, auto-application impossible). Nouvelle règle §15.0-bis introduite dans `CODING_RULES.md` : toute évolution ultérieure du framework est de niveau **C**. |
| 7 | Contradiction §13.4 (test requis) vs. absence de runner (aucune tâche ne peut être VALIDÉ). | Clause transitoire : test manuel ▶️ documenté vaut preuve. | `CODING_RULES.md §13.4-bis` ajoutée, cesse de s'appliquer dès `TEST_PLAN.md → J1`. |

### 🟡 Défauts mineurs

| # | Défaut | Décision responsable | Application |
|---|---|---|---|
| 8 | Zéro mécanisme automatisé — 100 % discipline. | Créer `scripts/check-ai.mjs` + `npm run ai:check`. | Fait. 9 règles automatisées (R1–R9). |
| 9 | `README.md` absent des `mandatory_documents`. | Corriger le manifest. | Ajouté. |
| 10 | `PROCESS_IMPROVEMENTS.md` proposait `check-ai.mjs` mais notait « hors périmètre `.ai/` ». | Trancher : oui, le framework peut produire du code hors de `.ai/`. | ADR-002 acté. Conditions : Node stdlib seul, script préfixé `ai:*`, piloté par le manifest, échec explicite, indépendant du build applicatif. |

## Suites

- **Version du framework** : 1.0.0 → **1.0.1** (voir `manifest.changelog`).
- **Preuve d'exécution requise** pour clôture VALIDÉ de T-000 v1.1 :
  ```
  npm run ai:check   →   9 OK · 0 warn · 0 fail · exit 0
  ```
  Résultat obtenu 🔨 avant commit final, consigné dans `TRACEABILITY.md`.
- **Prochaine itération** : T-001 (`JWT_SECRET` obligatoire au boot,
  niveau **C**), premier vrai déclenchement du cycle complet (analyse
  d'impact + conception + débat 11 rôles + double validation).

## Preuves de l'audit lui-même (§16)

- 🔍 lecture de tous les documents de `.ai/`.
- ▶️ exécution de `find .ai -type f`, `python3` sur `framework.manifest.json`,
  `git rev-parse --short HEAD`, `grep -oE` sur les liens Markdown.
- 🔨 après corrections : `node scripts/check-ai.mjs` retourne exit 0,
  9 OK / 0 warn / 0 fail.
