# 📁 .ai/ — Mémoire persistante de MyBestBooking

Ce dossier est la source documentaire officielle du projet **MyBestBooking**.
Il décrit l'application réelle : Next.js App Router, React, PostgreSQL et
Drizzle ORM.

Les rapports historiques provenant d'un autre projet sont conservés à titre
d'archive et ne décrivent pas l'architecture actuelle.

---

## 🧰 Commandes de validation

```powershell
Set-Location MyBestBooking
npm run typecheck
npm run lint
npm run build
npx drizzle-kit push
```

---

## 🔀 Workflow des évolutions importantes (Phase 7)

```
Audit → .ai/ → Code réel → Analyse d'impact §14 → Conception §15.1
  → Débat multi-rôles §15.2 → Décision → Développement
  → Compilation → Tests → Validation §13 → Impact post-correction
  → Documentation → Clôture → Rétrospective §17
```

**Proportionnalité** (`CODING_RULES.md` §15.0) — la profondeur suit l'impact,
jamais la taille du diff :

| Niveau | Exemple | Impact | Conception | Débat | Opportunités |
|---|---|---|---|---|---|
| **T** Trivial | typo, commentaire | ⬜ | ⬜ | ⬜ | ⬜ |
| **L** Local | refactor interne, ajout de test | allégée | ⬜ | ⬜ | ⬜ |
| **S** Structurant | signature publique, écran | ✅ | ✅ | si désaccord | ✅ |
| **C** Critique | sécurité, Room, migration, finance | ✅ | ✅ | ✅ | ✅ |

**Honnêteté technique** (§16) — toute affirmation est classée :
🔍 observé · 🔨 compilé · 🧪 testé · ▶️ exécuté · 🧠 déduit · ❓ hypothèse.

---

## 🚦 Procédure obligatoire à chaque session

0. **Vérifier PostgreSQL et `DATABASE_URL`**.
1. **Lire les documents de vérité applicables**.
2. **Analyser ensuite le code réel** (`app/src/...`).
3. **Si le code a divergé de la documentation → mettre `.ai/` à jour en premier**,
   avant toute nouvelle implémentation.
4. **Lire `CURRENT_TASK.md`** et exécuter **uniquement** cette tâche.
5. **Respecter `CODING_RULES.md`** et les conventions Next.js/React.
6. **Mettre à jour `PROGRESS.md` et `BACKLOG.md`** en fin de session.
7. **Attendre les instructions** du responsable avant de passer à la tâche suivante.

Prompt de démarrage prêt à copier : [`PROMPTS/session_start.md`](PROMPTS/session_start.md)

---

## 🗺️ Carte des fichiers

| Fichier | Rôle | Fréquence de mise à jour |
|---|---|---|
| `MISSION.md` | Mandat permanent de l'équipe technique | Rare |
| `PROJECT_CONTEXT.md` | Quoi, pour qui, pourquoi — métier et contraintes terrain | Rare |
| `ARCHITECTURE.md` | Architecture **réelle** constatée dans le code | À chaque changement structurel |
| `CODING_RULES.md` | Règles de code non négociables | Rare |
| `ANDROID_RULES.md` | Archive historique, non applicable à MyBestBooking | Ne pas utiliser |
| `DATABASE.md` | Entités, DAO, migrations, chiffrement | À chaque changement de schéma |
| `API.md` | Interfaces externes (SMS, Bluetooth, Intents, licence) | À chaque nouvelle intégration |
| `ROADMAP.md` | Ordre logique de complétion du projet | À chaque jalon |
| `BACKLOG.md` | Toutes les tâches restantes (□ / ☑) | **Chaque session** |
| `CURRENT_TASK.md` | La seule tâche autorisée en cours | **Chaque session** |
| `PROGRESS.md` | Journal horodaté des sessions | **Chaque session** |
| `BUGS.md` | Bugs identifiés, avec gravité et statut | Dès qu'un bug est trouvé/corrigé |
| `KNOWN_LIMITATIONS.md` | Limites assumées (non-bugs) | Rare |
| `DEPENDENCIES.md` | Dépendances, versions, risques | À chaque `libs.versions.toml` modifié |
| `SECURITY.md` | Modèle de menace et posture sécurité | À chaque changement crypto/permission |
| `TEST_PLAN.md` | Stratégie et couverture de tests | À chaque nouveau test |
| `PROCESS_IMPROVEMENTS.md` | Rétrospectives et évolutions du framework (§17) | Après chaque tâche |
| `DEV_ENVIRONMENT.md` | Node.js, PostgreSQL et variables d'environnement | À chaque changement d'outillage |
| `PROMPTS/` | Prompts réutilisables (démarrage, revue, rôles) | Rare |
| `CHECKLISTS/` | Contrôles avant commit / avant PR / avant release | Rare |
| `REPORTS/` | Modèles + rapports datés générés au fil du projet | À la demande |
| `LOGS/` | Journaux bruts de session (décisions, commandes) | Chaque session |

---

## 🧠 Rôles spécialisés

Toute décision technique importante doit être examinée selon les rôles
Architecture, Next.js/React, PostgreSQL/Drizzle, sécurité, QA, UX et DevOps.

---

## ✅ Règles d'or

- **Analyse d'impact avant toute modification** (`CODING_RULES.md` §14) :
  9 questions, enregistrée dans `REPORTS/`, antérieure au code.
- **Un correctif non exécuté est une hypothèse.** Compilation réelle + tests
  passés + aucune régression = seule définition de « terminé » (`CODING_RULES.md` §13).
- **Double validation** pour les composants critiques : test ciblé indépendant
  lorsque pertinent et validation réelle du code TypeScript/SQL.
- **Comprendre avant de modifier.**
- **Aucune régression** : une fonctionnalité qui marche ne doit jamais casser.
- **Une tâche à la fois**, celle de `CURRENT_TASK.md`.
- **Documenter dans `.ai/` fait partie de la définition de « terminé ».**
