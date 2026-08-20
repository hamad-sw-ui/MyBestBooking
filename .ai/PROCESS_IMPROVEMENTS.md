# 🔄 PROCESS_IMPROVEMENTS — journal des rétrospectives

Ce document capture les **améliorations du framework `.ai/` lui-même**,
séance après séance, conformément à `CODING_RULES.md` §17. Les propositions
ne s'appliquent **pas automatiquement** : elles alimentent une discussion
avec le responsable qui décide.

## Convention

Chaque entrée porte :

- **Date**
- **Contexte** — quelle session, quelle tâche
- **Ce qui a bien marché**
- **Ce qui a mal marché**
- **Propositions** — à ajouter, à modifier, à **retirer**
- **Décision** — statuée par le responsable, ou en attente

Une règle du framework qui **n'a servi personne en 3 sessions consécutives**
est explicitement candidate à la suppression.

---

## 2026-08-20 — Session 2 : mise en place du framework

**Tâche** : T-000 (mise en place du framework de gouvernance v1.0.0).

### Ce qui a bien marché

- La conservation de la couche contenu (PROJECT/ARCHITECTURE/…) permet
  d'ajouter la gouvernance sans jeter le travail précédent.
- Le manifest JSON force la cohérence : lister explicitement
  `mandatory_documents` évite qu'on en oublie un.
- La proportionnalité T/L/S/C évite d'appliquer le même cérémonial à une
  typo et à une refonte de l'auth.

### Ce qui a mal marché

- **Interprétation ambiguë** : la première réécriture avait supprimé la
  gouvernance. Le mot « gate » n'est pas univoque. Leçon : demander une
  clarification par `ask_user` dès qu'un mot du responsable est
  interprétable de deux façons contradictoires.
- **Rien n'automatise** la vérification du framework : un fichier
  obligatoire supprimé ne provoque aucune alerte. À traiter.

### Propositions

1. 🟢 **Ajouter** `scripts/check-ai.mjs` qui :
   - vérifie que chaque `mandatory_documents` du manifest existe ;
   - vérifie que `CURRENT_TASK.md` référence bien une tâche ouverte ;
   - vérifie que `STATE.md` a été mis à jour depuis le dernier commit non-doc.
   → à discuter, sortirait du périmètre `.ai/` (`scripts/` = code).
2. 🟢 **Ajouter** un hook Git pré-commit qui rejette un commit dont le
   message n'a pas de `<type>(<scope>)`.
3. 🟡 **Envisager** l'ajout d'un runner qui compte les tags §16 par rapport
   dans `REPORTS/` : un rapport sans 🔨/🧪/▶️ pour une tâche C serait signalé.
4. 🔴 **Ne rien retirer** pour l'instant — le framework n'a que 2 sessions
   de recul, il faut le laisser vivre.

### Décisions

- Proposition 1 : **actée en Session 3** — voir ADR-002, script livré.
- Proposition 2 : **en attente** (hook Git pre-commit).
- Proposition 3 : **notée pour plus tard**.
- Proposition 4 : **actée** — on garde tout tel quel jusqu'à au moins la
  session 5.

---

## 2026-08-20 — Session 3 : auto-audit du framework v1.0.0

**Tâche** : T-000 v1.1 (auto-audit + ajustements → framework v1.0.1).

### Ce qui a bien marché

- L'auto-audit a **immédiatement** détecté des incohérences (10 défauts)
  que la relecture Session 2 n'avait pas vues. Preuve que la discipline
  seule est insuffisante — un mécanisme externe est utile même quand
  l'auteur est attentif.
- La proportionnalité **T/L/S/C** a permis de traiter cette itération
  corrective en **S** (maintenance de framework) plutôt qu'en **C**,
  évitant le débat 11 rôles pour de la correction d'incohérences.
- Le script `scripts/check-ai.mjs` a **retourné exit 0** dès la première
  exécution post-corrections, avec 9 règles vertes. Vérification
  reproductible : `npm run ai:check`.

### Ce qui a mal marché

- **Le CURRENT_TASK.md v1** de la Session 2 avait ses 11 critères cochés
  `[x]` sans aucun tag §16 — l'auteur a violé sa propre règle sans s'en
  rendre compte. Leçon : imposer un tag §16 même pour les critères
  documentaires trivialement vérifiables.
- **STATE.md** a été écrit avant le commit final de Session 2 → il
  référençait un HEAD antérieur au sien. Leçon : la mise à jour du HEAD
  doit être la **toute dernière** modification avant `git commit`, ou
  formulée en « à mettre à jour en fin de session » (motif toléré par R7
  du script).

### Propositions

1. 🟢 **Ajouter un hook Git `pre-commit`** qui lance `npm run ai:check`
   automatiquement. Réservé à une prochaine itération — un hook peut être
   contourné (`--no-verify`), il ne remplace pas un job CI mais complète
   utilement le poste développeur.
2. 🟢 **Ajouter un job GitHub Actions `ai-check`** en pré-requis du job
   `build`. Piste solide dès qu'une CI existera.
3. 🟡 **Étendre `check-ai.mjs` pour vérifier les tags §16 sur les
   critères d'acceptation de `CURRENT_TASK.md`** (défaut #4 aurait été
   détecté mécaniquement). À évaluer selon la fréquence du défaut.

### Décisions

- Proposition 1, 2 : **en attente** — pas de CI actuellement, hook Git
  bienvenu à condition qu'il ne bloque pas les commits `WIP`.
- Proposition 3 : **notée**, à trancher après 2-3 tâches vécues.

---

## 2026-08-20 — Session 3, second tour : audit v1.0.1 → framework v1.0.2

**Tâche** : T-000 v1.2. Détail complet dans
`REPORTS/audit_2026-08-20_framework_v1.0.1_tour2.md`.

### Ce qui a bien marché

- Le fait de chercher **délibérément** des défauts « que le premier tour
  n'aurait pas vus » a trouvé 10 défauts nouveaux, dont 2 rouges structurels
  (collision d'IDs A, blocking_rules non implémentées B). Leçon : un audit
  doit changer d'angle à chaque tour, pas juste refaire le même passage.
- Le renommage massif `B-xxx` → `BUG-xxx`/`T-xxx` (66 occurrences, 16
  fichiers) a été fait par **script Python contrôlé** avec règles par
  fichier — 0 résidu, 0 renommage incorrect. À ré-employer pour toute
  migration transverse future.
- L'enrichissement des `blocking_rules` avec `implemented: true/false`
  est un modèle honnête : plutôt que de mentir en promettant une règle,
  on assume qu'elle est aspirationnelle.

### Ce qui a mal marché

- Le manifest v1.0.0 promettait 7 `blocking_rules` sans en implémenter
  vraiment aucune au-delà de R2. C'est de la **façade documentaire**,
  précisément ce que le framework est censé prévenir. Leçon : toute
  nouvelle règle publiée doit avoir sa règle Rn de vérification **dans
  le même commit**, ou être marquée explicitement `implemented: false`.
- 8 défauts jaunes restent non traités (C-J). Reportés à Session 4
  pour éviter la dispersion.

### Reportés à Session 4 (dette explicite)

- **C** — ajouter la clause §13.4-bis à `TEST_PLAN.md`.
- **D** — trancher le chevauchement `CODING_RULES §3/§5/§7` ↔
  `CODING_STYLE.md` : soit renvoyer, soit supprimer les redites.
- **E** — ajouter `Dernière révision` et `Version` à `ROADMAP.md` pour
  rendre la règle `obsolete_roadmap` mesurable, puis implémenter R14.
- **F** — étendre R7 à `PROGRESS.md` (règle R15) : le fichier doit avoir
  été modifié dans les N derniers jours ou N derniers commits.
- **G** — ajouter dans `INDEX.md` une note « pour lire le manifest, voir
  `npm run ai:check` qui affiche les règles ».
- **H** — clarifier `DEVLOG.md` (notes libres) vs `PROGRESS.md` (journal
  formel de session avec tags §16).
- **I** — remplacer les références en dur à `4ad8884` dans les documents
  vivants par « commit initial » quand la précision n'apporte rien.
- **J** — étendre R9 à `ADR/`, `REPORTS/`, `PROMPTS/`, `LOGS/`.

### Propositions du tour 2

1. 🟢 **Ajouter R14 obsolete_roadmap** dès que `ROADMAP.md` porte une
   date de révision. Rend enfin cette blocking_rule effective.
2. 🟢 **Ajouter R15 progress_freshness** : `PROGRESS.md` doit avoir été
   touché au dernier commit qui a modifié `src/` ou `.ai/*.md`.
3. 🟡 **Hook Git `pre-commit`** appelant `npm run ai:check` — utile
   comme filet en local, mais on garde en tête que c'est contournable
   (`--no-verify`). N'implémente pas `unchecked_pre_commit_checklist`
   au sens strict.

### Décisions

- Propositions 1, 2, 3 : **portées par Session 4** ou plus tard, à
  discrétion du responsable.

---

## Historique des règles

Ce sous-registre enregistre les **modifications du framework lui-même** —
règles ajoutées, retirées, renumérotées. Il permet de comprendre pourquoi
telle règle existe.

| Date | Règle | Action | Motif |
|---|---|---|---|
| 2026-08-20 | §1–§22 | **Créées** avec la v1.0.0 | Mise en place initiale du framework hybride pour MyBestBooking, dérivé d'AI-DOS 3.0 (MobileCaisse). |
| 2026-08-20 | §13.4-bis | **Ajoutée** (v1.0.1) | Clause transitoire : tant que `TEST_PLAN.md → J1` n'est pas livré, un test manuel ▶️ documenté vaut preuve §13.4. Sans cette clause, aucune tâche ne pouvait être clôturée `VALIDÉ` (aucun runner de test dans le dépôt). |
| 2026-08-20 | §15.0-bis | **Ajoutée** (v1.0.1) | Toute évolution du framework `.ai/` (règles §1–§22, `blocking_rules`, `mandatory_documents`, `roles`, table T/L/S/C) est de niveau **C**. Exception : correction d'incohérences internes = **S** (maintenance). Motif : contrepartie assumée du choix de traiter T-000 initial en S (voir ADR-001 § « Niveau assumé S : justification »). |
| 2026-08-20 | `README.md` | **Ajouté** à `mandatory_documents` (v1.0.1) | Défaut #9 de l'audit Session 3. Le README racine était de facto obligatoire mais non déclaré. |
| 2026-08-20 | `framework.manifest.json → reading_order` | **Étendu à 8 documents** (v1.0.1) | Défaut #2 de l'audit Session 3. Alignement avec `INDEX.md`. |
| 2026-08-20 | Automatisation hors `.ai/` | **Autorisée** (v1.0.1, ADR-002) | Le framework peut produire du code de vérification hors `.ai/` (ex : `scripts/check-ai.mjs`) sous 5 conditions : Node stdlib, script préfixé `ai:*`, piloté par le manifest, échec explicite, indépendant du build applicatif. |
| 2026-08-20 | §8.1 Convention d'IDs | **Ajoutée** (v1.0.2) | Défaut A du second tour d'audit. Deux séries strictement séparées : `BUG-xxx` pour bugs (source `BUGS.md`), `T-xxx` pour tâches (source `CURRENT_TASK.md`, `BACKLOG.md`, `TRACEABILITY.md`). Vérifiée par R11. |
| 2026-08-20 | `blocking_rules` format enrichi | **Modifié** (v1.0.2) | Défaut B du second tour d'audit. Passe de `bool` à `{blocking, implemented, verified_by?, note?}`. Rend explicite le fait qu'une règle peut être `blocking: true, implemented: false` (aspirationnelle) plutôt que promettre sans vérifier. |
| 2026-08-20 | R10 git_branch | **Ajoutée** (v1.0.2) | Vérifie que la branche courante = `arena/01a01eee-mybestbooking` (§8). Couvre partiellement `mismatched_git_state`. |
| 2026-08-20 | R11 id_collision | **Ajoutée** (v1.0.2) | Vérifie qu'aucun `B-xxx` résiduel ne subsiste dans `.ai/` (post-§8.1) et signale (warning informationnel) les numéros partagés BUG-/T-. |
| 2026-08-20 | R12 impact_reports_for_S_or_C | **Ajoutée** (v1.0.2) | Vérifie que `REPORTS/analyse_impact_*.md` et `REPORTS/analyse_conception_*.md` (ou `audit_*.md` par §15.0-bis) existent quand `CURRENT_TASK.md` est de niveau S ou C. Implémente `missing_impact_analysis_for_S_or_C`. |
| 2026-08-20 | R13 validated_items_have_evidence | **Ajoutée** (v1.0.2) | Vérifie que chaque item `CORRIGÉ (VALIDÉ)` dans `TRACEABILITY.md` porte au moins un tag de preuve exécutée 🔨/🧪/▶️. Implémente `closure_without_evidence`. |
