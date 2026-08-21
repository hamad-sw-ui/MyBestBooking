# 📁 `.ai/` — Framework de gouvernance de **MyBestBooking**

Ce dossier est la **source officielle de vérité** du projet et le **cadre
de gouvernance** de toutes les interventions techniques (humaines ou IA)
sur `hamad-sw-ui/MyBestBooking`.

Il existe pour deux raisons complémentaires :

1. **Documenter** ce que fait le projet, comment il est bâti, où regarder.
2. **Encadrer** les modifications : chaque changement suit une procédure
   proportionnée à son impact, produit des preuves auditables, et met à
   jour la mémoire du projet.

> ⚠️ Ce framework — **AI-DOS Web v1.0.0** — a été mis en place le
> 2026-08-20. Il **ne doit pas** être remplacé par un autre système sans
> discussion préalable et ADR dédié.

---

## 🚦 Procédure obligatoire à chaque session

**Ordre de lecture prescrit** (voir `INDEX.md`) :

1. `STATE.md` — mémoire courante
2. `INDEX.md` — carte du framework
3. `framework.manifest.json` — règles machine-lisibles
4. `MISSION.md` — mandat permanent
5. `CURRENT_TASK.md` — la **seule** tâche autorisée
6. `PROJECT.md` — contexte métier
7. `ARCHITECTURE.md` — architecture réelle
8. `CODING_RULES.md` — règles non négociables (§13 clôture, §14 impact,
   §16 honnêteté, §22 audit)

Prompt prêt à copier : **[`PROMPTS/session_start.md`](PROMPTS/session_start.md)**.

Ensuite :

- Analyser le code réel des fichiers concernés **et leurs appelants**
  (`grep -rn`).
- Si le code diverge de la documentation → mettre `.ai/` à jour **en
  premier**.
- Exécuter **une seule tâche à la fois** (`CURRENT_TASK.md`).
- Documenter la session en fin de travail (`STATE.md`, `PROGRESS.md`,
  `TRACEABILITY.md`, `BACKLOG.md`, `BUGS.md`).

---

## 🎚️ Proportionnalité T / L / S / C (`CODING_RULES.md` §15.0)

La profondeur des rituels **suit l'impact**, jamais la taille du diff :

| Niveau | Exemple | Impact | Conception | Débat | Opportunités | ADR |
|---|---|---|---|---|---|---|
| **T** Trivial | typo, commentaire | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **L** Local | refactor interne, test | allégée | ⬜ | ⬜ | ⬜ | ⬜ |
| **S** Structurant | route API, page, signature publique | ✅ | ✅ | si désaccord | ✅ | ✅ |
| **C** Critique | auth, paiement, migration DB destructive | ✅ | ✅ | ✅ | ✅ | ✅ + double validation |

Un niveau **C** exige la **double validation** (§13.5) : implémentation +
test indépendant validant le comportement.

---

## 🔍 Honnêteté technique (`CODING_RULES.md` §16)

Toute affirmation est classée par un **tag de preuve** :

- 🔍 **OBSERVED** — lu dans le code / le fichier / la sortie
- 🔨 **COMPILED** — `npm run typecheck` / `npm run build` a réussi
- 🧪 **TESTED** — un test automatisé passe
- ▶️ **EXECUTED** — commande lancée, requête curl réussie
- 🧠 **DEDUCED** — déduit logiquement, non vérifié
- ❓ **HYPOTHESIS** — hypothèse à confirmer

**Interdit** : marquer un item `CORRIGÉ (VALIDÉ)` sans au moins un 🔨,
🧪 ou ▶️. Un audit §22 peut refaire tomber tout item validé sans preuve.

---

## 🗺️ Carte des fichiers

| Fichier | Rôle | Fréquence de mise à jour |
|---|---|---|
| `MISSION.md` | Mandat permanent | Jamais (sauf changement de mandat) |
| `INDEX.md` | Ordre de lecture prescrit | Rare |
| `framework.manifest.json` | Règles machine-lisibles | À chaque évolution du framework |
| `STATE.md` | Mémoire officielle courante — **source de vérité n°1** | **Chaque session** |
| `CURRENT_TASK.md` | Tâche unique en cours | **Chaque session** |
| `PROGRESS.md` | Journal horodaté | **Chaque session** |
| `TRACEABILITY.md` | Matrice preuves ↔ tâches | **Chaque session** |
| `PROJECT.md` | Contexte métier, glossaire | Rare |
| `ARCHITECTURE.md` | Architecture réelle constatée | À chaque changement structurel |
| `DATABASE.md` | Schéma Drizzle, index, migrations | À chaque changement de schéma |
| `API.md` | Endpoints REST, contrats | À chaque changement d'API |
| `UI.md` | Design system, pages | À chaque changement d'UX |
| `SECURITY.md` | Auth, cookies, headers | À chaque changement crypto/auth |
| `CODING_RULES.md` | Règles non négociables (§1–§22) | Rare |
| `CODING_STYLE.md` | Conventions TS/React/Drizzle/Tailwind | Rare |
| `DEV_ENVIRONMENT.md` | `.env`, DB locale, scripts | À chaque outillage |
| `DEPENDENCIES.md` | Libs et versions | À chaque `package.json` modifié |
| `ROADMAP.md` | Jalons planifiés | À chaque jalon |
| `BACKLOG.md` | Toutes les tâches restantes | **Chaque session** |
| `BUGS.md` | Bugs identifiés avec statut | Dès un bug trouvé/corrigé |
| `TEST_PLAN.md` | Stratégie et couverture | À chaque nouveau test |
| `KNOWN_LIMITATIONS.md` | Limites assumées (non-bugs) | Rare |
| `PROCESS_IMPROVEMENTS.md` | Rétrospectives §17 | Après chaque session non triviale |
| `DEVLOG.md` | Journal libre, complément | Optionnel |
| `PROMPTS/` | Prompts réutilisables (démarrage prescrit, rôles prescrit) | Rare |
| `CHECKLISTS/` | Contrôles ⛔ **bloquants** avant commit / PR / release | Rare |
| `ADR/` | Décisions structurantes (obligatoire S, C) | À chaque décision |
| `REPORTS/` | Analyses d'impact, conception, débats, audits (obligatoire S, C) | À chaque tâche S/C |
| `LOGS/` | Journaux bruts optionnels | Optionnel |

---

## 🧠 Rôles spécialisés (`PROMPTS/roles.md`)

Toute décision technique de niveau **C** (ou **S** en cas de désaccord)
doit être raisonnée successivement selon **11 rôles** : Architecte,
Développeur Next.js senior, Expert TypeScript, Expert React (RSC/Client),
Expert Drizzle/SQL, Expert PostgreSQL, Expert sécurité web, Ingénieur QA,
DevOps/SRE, Expert UX/a11y, Relecteur (advocatus diaboli).

Le débat est consigné dans `REPORTS/debat_technique_<date>_<sujet>.md`.

---

## ⛔ Règles bloquantes (`framework.manifest.json`)

- Document obligatoire manquant → blocage
- Roadmap obsolète → blocage
- État Git incohérent (branche ≠ `arena/01a01eee-mybestbooking`) → blocage
- Checklist `avant_commit` non déroulée sans justification → blocage
- Tâche S/C sans analyse d'impact préalable → blocage
- Clôture (`VALIDÉ`) sans preuve dans `TRACEABILITY.md` → blocage

Ces règles sont **appliquées par la personne (humaine ou IA) qui reçoit le
livrable**. L'honnêteté (« je n'ai pas pu vérifier car… ») est **acceptée** ;
l'invisibilité (silence sur une limite) est **refusée**.

---

## ✅ Règles d'or

- **Analyse d'impact avant toute modification S/C** (`CODING_RULES.md` §14) :
  9 questions, écrite dans `REPORTS/`, antérieure au code.
- **Un correctif non exécuté est une hypothèse.** Typecheck + build + tests
  + zéro régression = seule définition de « terminé » (§13).
- **Double validation** pour les composants critiques : implémentation +
  test indépendant (§13.5).
- **Comprendre avant de modifier** (grep les appelants).
- **Aucune régression** : une fonctionnalité qui marche ne doit jamais
  casser.
- **Une tâche à la fois**, celle de `CURRENT_TASK.md`.
- **Documenter dans `.ai/` fait partie de la définition de « terminé »**
  (§11).
- **Rétrospective** en fin de session (§17) → `PROCESS_IMPROVEMENTS.md`.
