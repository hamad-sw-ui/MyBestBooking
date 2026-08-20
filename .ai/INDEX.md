# 📇 INDEX DU FRAMEWORK IA

Ce document est le **point d'entrée unique et obligatoire** du framework. Il
répertorie tous les documents constituant la « Source de Vérité » du projet
MyBestBooking et prescrit l'ordre de lecture.

## 🚦 Ordre de lecture obligatoire au démarrage de session

1. **[STATE.md](STATE.md)** — mémoire officielle courante
2. **[INDEX.md](INDEX.md)** — ce document
3. **[framework.manifest.json](framework.manifest.json)** — règles machine-lisibles
4. **[MISSION.md](MISSION.md)** — mandat permanent
5. **[CURRENT_TASK.md](CURRENT_TASK.md)** — la seule tâche autorisée en cours
6. **[PROJECT.md](PROJECT.md)** — contexte métier
7. **[ARCHITECTURE.md](ARCHITECTURE.md)** — architecture réelle du code
8. **[CODING_RULES.md](CODING_RULES.md)** — règles non négociables (§13, §14, §16, §22)

Cet ordre est prescriptif : sauter une étape est une violation du framework
(voir `framework.manifest.json → blocking_rules`).

## 📜 Documents Fondamentaux (Obligatoires)

- **[STATE.md](STATE.md)** — État courant du projet (Source de Vérité n°1)
- **[MISSION.md](MISSION.md)** — Objectifs globaux et périmètre d'intervention
- **[PROJECT.md](PROJECT.md)** — Identité, périmètre métier, glossaire
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Architecture réellement constatée dans le code
- **[DATABASE.md](DATABASE.md)** — Schéma Drizzle, tables, index, migrations
- **[API.md](API.md)** — Endpoints REST, contrats d'entrée/sortie, auth
- **[SECURITY.md](SECURITY.md)** — Modèle d'auth, cookies, hachage, headers
- **[CODING_RULES.md](CODING_RULES.md)** — Règles de développement, §13 clôture, §14 impact, §15 conception, §16 honnêteté, §17 rétro, §22 audit des preuves
- **[CODING_STYLE.md](CODING_STYLE.md)** — Conventions TS/React/Drizzle/Tailwind
- **[ROADMAP.md](ROADMAP.md)** — Planification des jalons
- **[BACKLOG.md](BACKLOG.md)** — Liste exhaustive des tâches (B-xxx)
- **[BUGS.md](BUGS.md)** — Registre des défauts et statuts
- **[CURRENT_TASK.md](CURRENT_TASK.md)** — Tâche en cours (une seule)
- **[TRACEABILITY.md](TRACEABILITY.md)** — Matrice Bug/Tâche ↔ Preuve
- **[TEST_PLAN.md](TEST_PLAN.md)** — Stratégie et couverture de tests
- **[PROGRESS.md](PROGRESS.md)** — Journal horodaté des sessions

## 🛠️ Documents Complémentaires

- **[UI.md](UI.md)** — Charte, design system, cartographie des pages
- **[DEPENDENCIES.md](DEPENDENCIES.md)** — Bibliothèques et versions
- **[DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md)** — `.env`, scripts, seed
- **[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)** — Limites assumées (non-bugs)
- **[PROCESS_IMPROVEMENTS.md](PROCESS_IMPROVEMENTS.md)** — Rétrospectives (§17)
- **[DEVLOG.md](DEVLOG.md)** — Journal libre, complément de `PROGRESS.md`

## 📂 Dossiers Spécifiques

- **[ADR/](ADR/README.md)** — Architecture Decision Records (obligatoires pour S et C)
- **[REPORTS/](REPORTS/README.md)** — Analyses d'impact, débats techniques, audits (obligatoires pour S et C)
- **[CHECKLISTS/](CHECKLISTS/README.md)** — Contrôles bloquants avant commit / PR / release
- **[PROMPTS/](PROMPTS/README.md)** — Prompts réutilisables (démarrage, revue, rôles)
- **[LOGS/](LOGS/README.md)** — Journaux bruts de session

## 🎚️ Proportionnalité T/L/S/C

La profondeur des rituels **suit l'impact, pas la taille du diff**
(`CODING_RULES.md` §15.0). Résumé :

| Niveau | Exemple | Impact | Conception | Débat | Opportunités | ADR |
|---|---|---|---|---|---|---|
| **T** Trivial | typo, commentaire | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **L** Local | refactor interne, ajout de test | allégée | ⬜ | ⬜ | ⬜ | ⬜ |
| **S** Structurant | route API, page, signature publique | ✅ | ✅ | si désaccord | ✅ | ✅ |
| **C** Critique | auth, paiement, migration DB destructive | ✅ | ✅ | ✅ | ✅ | ✅ + double validation |

Un niveau **C** exige en plus la **double validation** (§13.5) : implémentation
+ test automatisé indépendant validant le comportement.

## 🔍 Honnêteté technique — tags de preuve

Toute affirmation dans `.ai/` doit être classée (`CODING_RULES.md` §16) :

- 🔍 **OBSERVED** — constaté dans le code
- 🔨 **COMPILED** — typecheck ou build a réussi
- 🧪 **TESTED** — test automatisé passe
- ▶️ **EXECUTED** — exécuté à la main (dev server, curl)
- 🧠 **DEDUCED** — déduit logiquement, non vérifié
- ❓ **HYPOTHESIS** — hypothèse à confirmer

Un rapport sans aucune preuve ▶️/🔨/🧪 pour une tâche S ou C est **refusé**.

## ⛔ Règles bloquantes (extrait `framework.manifest.json`)

- Document obligatoire manquant → **blocage**
- Roadmap obsolète → **blocage**
- État Git incohérent (branche autre que `arena/01a01eee-mybestbooking`) → **blocage**
- Checklist `avant_commit` non déroulée sans justification → **blocage**
- Tâche S/C sans analyse d'impact préalable → **blocage**
- Clôture sans preuve d'exécution → **blocage**

Ces règles sont **appliquées par la personne (humaine ou IA) qui reçoit le
livrable**, pas par un outil. La règle « je n'ai pas vérifié parce que
l'environnement ne permettait pas » est **acceptée** à condition d'être
écrite explicitement dans `PROGRESS.md` — l'invisibilité est refusée, pas
l'honnêteté sur les limites.
