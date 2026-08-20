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

**Tâche** : B-000 (mise en place du framework de gouvernance v1.0.0).

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

**Tâche** : B-000 v1.1 (auto-audit + ajustements → framework v1.0.1).

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

## Historique des règles

Ce sous-registre enregistre les **modifications du framework lui-même** —
règles ajoutées, retirées, renumérotées. Il permet de comprendre pourquoi
telle règle existe.

| Date | Règle | Action | Motif |
|---|---|---|---|
| 2026-08-20 | §1–§22 | **Créées** avec la v1.0.0 | Mise en place initiale du framework hybride pour MyBestBooking, dérivé d'AI-DOS 3.0 (MobileCaisse). |
| 2026-08-20 | §13.4-bis | **Ajoutée** (v1.0.1) | Clause transitoire : tant que `TEST_PLAN.md → J1` n'est pas livré, un test manuel ▶️ documenté vaut preuve §13.4. Sans cette clause, aucune tâche ne pouvait être clôturée `VALIDÉ` (aucun runner de test dans le dépôt). |
| 2026-08-20 | §15.0-bis | **Ajoutée** (v1.0.1) | Toute évolution du framework `.ai/` (règles §1–§22, `blocking_rules`, `mandatory_documents`, `roles`, table T/L/S/C) est de niveau **C**. Exception : correction d'incohérences internes = **S** (maintenance). Motif : contrepartie assumée du choix de traiter B-000 initial en S (voir ADR-001 § « Niveau assumé S : justification »). |
| 2026-08-20 | `README.md` | **Ajouté** à `mandatory_documents` (v1.0.1) | Défaut #9 de l'audit Session 3. Le README racine était de facto obligatoire mais non déclaré. |
| 2026-08-20 | `framework.manifest.json → reading_order` | **Étendu à 8 documents** (v1.0.1) | Défaut #2 de l'audit Session 3. Alignement avec `INDEX.md`. |
| 2026-08-20 | Automatisation hors `.ai/` | **Autorisée** (v1.0.1, ADR-002) | Le framework peut produire du code de vérification hors `.ai/` (ex : `scripts/check-ai.mjs`) sous 5 conditions : Node stdlib, script préfixé `ai:*`, piloté par le manifest, échec explicite, indépendant du build applicatif. |
