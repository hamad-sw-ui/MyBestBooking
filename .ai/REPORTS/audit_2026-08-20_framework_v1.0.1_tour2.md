# Audit du framework `.ai/` v1.0.1 — second tour

- **Date** : 2026-08-20 (Session 3, second tour)
- **Auteur** : Arena Agent Mode (auto-audit à la demande du responsable :
  « les deux » = valider **et** ajuster)
- **Objet** : Chercher activement des défauts que le premier tour n'aurait
  pas vus (commit `cbb3b2e`, framework v1.0.1).
- **Tâche déclenchée** : T-000 v1.2 → livre framework v1.0.2

---

## Méthode

Deux angles d'attaque volontairement différents du premier tour :

1. **Cohérence promesse-vs-réalité** : le framework promet des règles
   dans `framework.manifest.json → blocking_rules`. Le script les
   applique-t-il vraiment ?
2. **Cohérence transversale** : les identifiants, les niveaux, les liens,
   les rôles… ont-ils une définition unique dans tout le dossier ?

Vérifications automatisées via `python3`, `grep`, comparaison manifest ↔
`.md`, inventaire des références croisées.

## Résultats — 10 nouveaux défauts

### 🔴 Défauts rouges

| # | Défaut | Preuve (§16) |
|---|---|---|
| **A** | **Collision d'ID `B-001`** : à la fois bug (dans `BUGS.md` = JWT_SECRET) et tâche prévue (dans `STATE.md`, `CURRENT_TASK.md`, `PROGRESS.md`). Le framework ne distinguait pas Bug ↔ Tâche. | 🔍 `grep -oE "B-0[0-9]+" .ai/*.md` révèle `B-001` dans 4 rôles différents |
| **B** | **`blocking_rules` non implémentées** : le manifest en promet 7, le script en vérifiait complètement **1 seule** (R2). Framework fait des promesses vides. | 🔍 inventaire manifest ↔ règles Rn : 6 règles sur 7 non couvertes ou partielles |

### 🟠 Fragilités notables

| # | Défaut | Effet |
|---|---|---|
| **C** | `TEST_PLAN.md` ne mentionne nulle part la clause §13.4-bis créée en v1.0.1. La bascule (« cesse de s'appliquer dès J1 ») peut être oubliée. | Dette latente |
| **D** | Chevauchement `CODING_RULES §3, §5, §7` ↔ `CODING_STYLE.md` (Zod, gestion d'erreurs, RSC, `<img>`). | Risque de divergence future |
| **E** | `ROADMAP.md` sans date ni version → règle `obsolete_roadmap` inapplicable. | Règle vide |

### 🟡 Défauts mineurs

| # | Défaut |
|---|---|
| F | `PROGRESS.md` non vérifié par aucune règle |
| G | `INDEX.md` prescrit « lire un JSON », inhabituel pour un humain |
| H | `DEVLOG` et `PROGRESS` rôles se chevauchent |
| I | Références en dur à `4ad8884` dans plusieurs docs |
| J | R9 ne couvre pas les liens des fichiers non-obligatoires |

## Décisions du responsable

Prises par `ask_user` interactif :

- **A → « préfixes distincts »** : `BUG-xxx` pour bugs, `T-xxx` pour tâches.
- **B → « hybride »** : implémenter R10-R13, marquer les 2 règles non
  implémentables comme `implemented: false`.
- **C-J → « reporter »** : ces défauts iront dans
  `PROCESS_IMPROVEMENTS.md` pour Session 4. Pas de dispersion cette
  session.

## Corrections appliquées (framework v1.0.2)

### Défaut A — convention d'IDs §8.1

- **66 occurrences** de `B-xxx` renommées dans 16 fichiers via un script
  Python contrôlé :
  - Fichiers 100 % bugs (`BUGS.md`, `KNOWN_LIMITATIONS.md`,
    `CHECKLISTS/avant_release.md`) → tous les `B-xxx` → `BUG-xxx`.
  - Fichiers 100 % tâches (9 fichiers dont `CURRENT_TASK`,
    `TRACEABILITY`, `PROCESS_IMPROVEMENTS`, `CODING_RULES`, ADRs,
    rapports de gouvernance) → tous les `B-xxx` → `T-xxx`.
  - Fichiers mixtes (`STATE.md`, `PROGRESS.md`, 2 rapports) → règles
    ligne à ligne selon le contexte sémantique.
- **Nouvelle règle §8.1** dans `CODING_RULES.md` — convention formalisée.
- **Vérification post-migration** : `grep -oE "\bB-[0-9]+"` sur tout
  `.ai/` retourne 0 résidu.

### Défaut B — blocking_rules enrichies + R10-R13

Le format des `blocking_rules` du manifest passe de `bool` à objet :

```json
{
  "missing_mandatory_document": {
    "blocking": true,
    "implemented": true,
    "verified_by": "R2 mandatory_present"
  },
  ...
  "obsolete_roadmap": {
    "blocking": true,
    "implemented": false,
    "note": "Aspirational : aucun critère mesurable dans ROADMAP.md aujourd'hui."
  }
}
```

Nouvelles règles du script :

- **R10** — `git rev-parse --abbrev-ref HEAD` doit être
  `arena/01a01eee-mybestbooking` (§8).
- **R11** — aucun ID `B-xxx` résiduel dans `.ai/` (post-§8.1). Warning
  informationnel si un numéro (ex : `001`) apparaît à la fois en `BUG-`
  et `T-` : autorisé mais signalé.
- **R12** — si `CURRENT_TASK.md → Niveau` est S ou C, alors un
  `REPORTS/analyse_impact_*.md` et un `REPORTS/analyse_conception_*.md`
  doivent exister. Un `audit_*.md` est accepté comme équivalent §15.0-bis
  (maintenance).
- **R13** — chaque ligne de `TRACEABILITY.md` marquée `CORRIGÉ (VALIDÉ)`
  doit contenir au moins un tag de preuve exécutée : 🔨, 🧪 ou ▶️.

Deux règles restent explicitement **aspirationnelles**
(`implemented: false`) :

- `unchecked_pre_commit_checklist` — nécessite un hook Git, contournable
  via `--no-verify` — reporté Session 4.
- `obsolete_roadmap` — nécessite d'ajouter d'abord une date/version dans
  `ROADMAP.md` — reporté Session 4.

## Preuve d'exécution (§13.4-bis, §22)

```
$ npm run ai:check

┌─ AI-DOS Web — check-ai v1.0.2
│
│ ✅ R1  manifest_json_valid    parsé sans erreur
│ ✅ R2  mandatory_present      18 documents obligatoires
│ ✅ R3  optional_present       6 documents optionnels
│ ✅ R4  reading_order_valid    reading_order (8) tous existants
│ ✅ R5  roles_aligned          11 rôles alignés
│ ✅ R6  proportionality_TLSC   T/L/S/C tous présents
│ ⚠️ R7  state_head_synced      motif toléré ("à mettre à jour en fin de session")
│ ✅ R8  current_task_shape     tâche T-xxx + statut valide
│ ✅ R9  internal_links         aucun lien cassé
│ ✅ R10 git_branch             arena/01a01eee-mybestbooking
│ ⚠️ R11 id_collision           numéros partagés 001 (informationnel)
│ ✅ R12 impact_reports_for_S_or_C  rapport d'impact + conception présents
│ ✅ R13 validated_items_have_evidence  aucun item VALIDÉ sans preuve
│
└─ 11 OK · 2 warn · 0 fail
```

Les 2 warnings sont **attendus et documentés** :

- **R7** : motif toléré (STATE.md sera mis à jour au commit final).
- **R11** : le numéro `001` existe en `BUG-001` (JWT_SECRET, dans BUGS)
  et `T-001` (tâche JWT_SECRET à ouvrir, dans STATE/CURRENT_TASK) — c'est
  cohérent, les deux réfèrent au même problème sous deux angles.

## Reportés à Session 4

Défauts C, D, E, F, G, H, I, J tracés dans `PROCESS_IMPROVEMENTS.md`.

## Preuves de l'audit lui-même (§16)

- 🔍 lecture des 27 fichiers de `.ai/` + `scripts/check-ai.mjs`.
- ▶️ `grep`, `python3`, `git rev-parse`, `find`.
- 🔨 après corrections : `npm run ai:check` → 11 OK · 2 warn · 0 fail.
- 🧠 la migration BUG-/T- a été faite par script Python contrôlé, pas à
  la main — le risque de renommage incorrect est borné.
