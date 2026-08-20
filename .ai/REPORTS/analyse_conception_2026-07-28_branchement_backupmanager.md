# Conception technique — Branchement de `BackupManager`

**Date** : 2026-07-28 · **Réf.** : B-101 / BUG-017
**Niveau** : **C — Critique** *(sécurité + format persisté + données financières
irremplaçables)*
**Analyse d'impact préalable** : `analyse_impact_2026-07-28_branchement_backupmanager.md`

---

## 1. Objectif

Remplacer l'export de sauvegarde non protégé par un mécanisme réellement chiffré
par mot de passe utilisateur, sur les trois chemins où une saisie est possible.

**Si l'on ne fait rien** : 🔍 *observé* — `BackupManager` (PBKDF2 100 000
itérations, AES-GCM, checksum) reste inutilisé, et les exports continuent de
partir par `ACTION_SEND` sans protection propre. La sécurité repose alors
entièrement sur le `managerCode`, dont dérive la clé SQLCipher — un secret unique
pour deux usages.

## 2. Problème actuel

### Fonctionnement présent
🔍 *Observé dans le code* — cinq chemins de sauvegarde, aucun n'utilisant `BackupManager` :

| Chemin | Point d'entrée | Mécanisme |
|---|---|---|
| A | `SettingsScreen:119` → `MainViewModel:463` → `MainRepository:889` | copie `.db` + `ACTION_SEND` |
| B | `ClosureScreen:144` → `ClosureScreen:198` | copie `.db` + `ACTION_SEND`, **fonction locale à l'écran** |
| C | `RestorationWizardScreen:112` → `MainViewModel:433` → `MainRepository:801` | copie de fichier, `db.close()` **avant** copie |
| D | `SetupScreen:148` | restauration du miroir au premier lancement |
| E | `BackupWorker:23,30` | sauvegarde quotidienne + miroir externe |

### Limites

| # | Limite | Conséquence |
|---|---|---|
| L1 | Aucun mot de passe utilisateur | la protection repose sur le seul `managerCode` |
| L2 | Aucun contrôle d'intégrité | une archive corrompue n'est détectée qu'à la restauration |
| L3 | `db.close()` précède la copie (chemin C) | 🧠 *déduit* — un échec laisse l'application sans base |
| L4 | Copie en mode WAL sans checkpoint | BUG-011 — sauvegarde potentiellement incohérente |
| L5 | Aucune distinction de format | un `.zip` pourrait être traité comme un `.db` |
| L6 | Logique de fichier dans un Composable (chemin B) | violation MVVM |

### Contraintes

| Contrainte | Origine | Négociable ? |
|---|---|---|
| Mot de passe saisi **manuellement** à chaque export | décision D2-C | ❌ non |
| Chemins D et E **sans interface** | nature de `SetupScreen` (avant configuration) et de `BackupWorker` | ❌ non |
| `MainViewModel` unique, ~30 écrans | architecture actuelle | ❌ non (jusqu'à J5) |
| minSdk 24 | `build.gradle.kts` | ❌ non |
| Ne pas régresser les 5 correctifs de sécurité | `SECURITY.md` §0 | ❌ non |
| Aucune dépendance réseau | hors-ligne d'abord | ❌ non |

---

## 3. Solutions possibles

### Solution A — Migration totale : tous les chemins vers `BackupManager`

**Principe** : les cinq chemins produisent une archive chiffrée. Pour D et E, la
clé est dérivée du `managerCode` faute de saisie possible.

| Critère | Évaluation |
|---|---|
| Avantages | Un seul format. Cohérence maximale. Aucune sauvegarde non protégée. |
| Inconvénients | 🔴 **Viole la décision D2-C** : recrée un secret recalculable à partir d'informations pouvant fuir ensemble. Reproduit exactement le défaut corrigé sur la clé SQLCipher. |
| Complexité | Élevée — refonte des 5 chemins |
| Performances | Chiffrement supplémentaire dans le worker quotidien |
| Sécurité | ❌ **Régression** sur D et E |
| Maintenabilité | Bonne (format unique) |
| Impact architecture | Fort |

### Solution B — Migration partielle : A, B, C uniquement *(coexistence de deux formats)*

**Principe** : les chemins avec interface passent au format chiffré par mot de
passe ; D et E conservent la copie `.db` (protégée par SQLCipher). L'import
détecte le format.

| Critère | Évaluation |
|---|---|
| Avantages | Respecte D2-C. Aucune régression sur D/E. Rétrocompatible. Incrémental et réversible. |
| Inconvénients | Deux formats coexistent — charge cognitive pour l'utilisateur, à documenter dans l'UI |
| Complexité | Moyenne |
| Performances | Chiffrement uniquement sur action explicite |
| Sécurité | ✅ Améliore A/B/C, ne dégrade rien |
| Maintenabilité | Moyenne — un aiguillage de format à maintenir |
| Impact architecture | Modéré ; corrige au passage la violation MVVM du chemin B |

### Solution C — Différer : corriger d'abord les fondations *(BUG-011, R2), brancher ensuite)*

**Principe** : traiter B-013 (checkpoint WAL) et B-140 (restauration en fichier
temporaire) avant tout branchement, puis appliquer B.

| Critère | Évaluation |
|---|---|
| Avantages | Ne construit pas sur des fondations défaillantes. Chaque correctif est validable isolément. |
| Inconvénients | Retarde la sécurisation visible par l'utilisateur |
| Complexité | Faible par étape |
| Performances | Neutre |
| Sécurité | ✅ Meilleure à terme |
| Maintenabilité | Excellente |
| Impact architecture | Faible |

### Solution D — Ne rien faire

| Critère | Évaluation |
|---|---|
| Avantages | Coût nul, risque nul de régression |
| Inconvénients | BUG-017 persiste ; du code de sécurité écrit reste inutilisé |
| Sécurité | ❌ statu quo insatisfaisant |

### Comparatif

| Critère | A | B | C | D |
|---|---|---|---|---|
| Complexité | Élevée | Moyenne | Faible/étape | Nulle |
| Sécurité | ❌ régression | ✅ | ✅✅ | ❌ |
| Respect de D2-C | ❌ | ✅ | ✅ | — |
| Rétrocompatibilité | ❌ | ✅ | ✅ | ✅ |
| Réversibilité | Faible | Bonne | Excellente | — |
| Coût | 3–4 sessions | 2 sessions | 3 sessions | 0 |

---

## 4. Solution retenue

**Retenue : C** — corriger les fondations (B-013, B-140, B-141), puis appliquer B.

**Pourquoi meilleure que les autres**

- *vs A* : A **viole frontalement la décision D2-C**. Dériver la clé de
  sauvegarde du `managerCode` recréerait un secret recalculable — le défaut même
  qui a été corrigé sur la clé SQLCipher. Un format unique ne vaut pas cette
  régression.
- *vs B* : B est la bonne cible, mais brancher avant d'avoir corrigé le
  checkpoint WAL (L4) et le `db.close()` prématuré (L3) reviendrait à construire
  sur deux défauts connus. 🧠 *Déduit* : après l'étape 6, il ne resterait qu'un
  chemin de sauvegarde ; s'il produit des archives incohérentes, il n'y a plus de
  filet.
- *vs D* : le statu quo laisse du code de sécurité inutilisé et un mécanisme
  d'export non protégé.

**Ce que la solution sacrifie** : la sécurisation visible par l'utilisateur est
retardée d'environ une session. Compromis acceptable — aucun utilisateur en
production (confirmé par le responsable).

---

## 5. Risques

| # | Risque | Niveau | Prob. | Atténuation | Détection |
|---|---|---|---|---|---|
| R1 | Archive `.zip` confondue avec un `.db` | **Élevé** | Moyenne | Détection par magie de fichier `PK\x03\x04` (B-141) | test unitaire |
| R2 | `db.close()` puis échec → app sans base | **Critique** | Moyenne | Restauration en fichier temporaire, remplacement après checksum (B-140) | test instrumenté |
| R3 | Mot de passe oublié → sauvegarde perdue | **Élevé** | Élevée | Avertissement UI non contournable (B-143) | — |
| R4 | Copie WAL incohérente | **Élevé** | Élevée | `wal_checkpoint(FULL)` avant copie (B-013) | test instrumenté |
| R5 | Régression de `SecurityMigrationTest` | Moyen | Faible | Relancer les tests instrumentés | CI |
| R6 | Chemins D/E cassés collatéralement | Moyen | Moyenne | Ne pas toucher `backupDatabase()` | test de non-régression |
| R7 | Mot de passe conservé en mémoire/journal | **Critique** | Faible | Jamais journalisé, effacé du `State` après usage | revue de code |
| R8 | OOM sur gros fichier | Faible | Faible | Déjà traité — chiffrement en flux 8 Ko | test 4 Mo existant |

---

## 6. Compatibilité

| Dimension | Impact | Détail |
|---|---|---|
| Rétrocompatibilité | ✅ préservée | l'import accepte `.zip` **et** `.db` legacy |
| Migrations | ⬜ aucune | aucun changement de schéma Room |
| Utilisateurs | ⚠️ visible | saisie d'un mot de passe à l'export ; nouvelle étape dans l'assistant |
| Données | ✅ aucun risque | aucune écriture destructive ; restauration en fichier temporaire |
| Performances | ⚠️ mesurable | PBKDF2 100 000 itérations ≈ 100–300 ms sur appareil modeste, **une fois par opération** — acceptable |

---

## 7. Plan de développement

| # | Étape | Livrable | Validation | Réversible ? |
|---|---|---|---|---|
| 0 | **Prérequis** : 26 tests `BackupManager` verts | rapport de tests | `test.sh` | — |
| 1 | B-013 — checkpoint WAL avant copie | `MainRepository` | test instrumenté | ✅ |
| 2 | B-140 — restauration en fichier temporaire | `MainRepository` | test instrumenté | ✅ |
| 3 | B-141 — détection de format | `BackupFormat.detect()` | test unitaire | ✅ |
| 4 | Repository : `exportEncryptedBackup` / `importEncryptedBackup` | `MainRepository` | tests unitaires | ✅ |
| 5 | ViewModel : 3 fonctions + `BackupUiState` | `MainViewModel` | tests | ✅ |
| 6 | B-142 — `BackupPasswordDialog` réutilisable | composant Compose | preview + test UI | ✅ |
| 7 | Branchement A (`SettingsScreen`) | UI | vérification manuelle | ✅ |
| 8 | Branchement B (`ClosureScreen`) + suppression de la fonction locale | UI | vérification manuelle | ✅ |
| 9 | Branchement C (`RestorationWizardScreen`) + étape mot de passe | UI | vérification manuelle | ✅ |
| 10 | B-143/B-144 — avertissements UI | UI | relecture | ✅ |
| 11 | **Étape 6 du plan** : suppression de l'ancien mécanisme | — | non-régression complète | ❌ **non réversible** |

**Point de non-retour** : étape 11. Jusque-là, l'ancien mécanisme reste
disponible en repli.

---

## 8. Plan de retour arrière

### Pendant le développement (étapes 1–10)
```bash
git revert <sha>                 # par étape, chacune étant indépendante
```
Aucune donnée n'est affectée : les anciens chemins restent fonctionnels.

### Après l'étape 11
| Situation | Procédure | Données récupérables ? |
|---|---|---|
| Le nouveau format échoue à l'import | `git revert` + restauration d'un `.db` legacy | ✅ oui, si un `.db` existe |
| Archives `.zip` illisibles | Le déchiffrement ne dépend que du mot de passe : réimplémentable via `tools/verification/` | ✅ oui |
| Régression sur la base active | Restauration depuis `filesDir/daily_backup.db` (chemin E, conservé) | ✅ oui |

⚠️ **Aucune migration Room n'est impliquée** : le retour arrière reste possible
à tout moment, contrairement à un changement de schéma. C'est un argument
supplémentaire en faveur de l'ordre retenu.

### Conditions de déclenchement du retour arrière
- [ ] un test de non-régression échoue et la cause n'est pas identifiée en une session ;
- [ ] une archive produite par le nouveau format s'avère non restaurable ;
- [ ] `SecurityMigrationTest` régresse.

---

**Conception validée le** : 2026-07-28
**Débat multi-rôles requis** : ☑ **oui** — niveau C
**Le développement peut commencer** : ☐ oui ☑ **non** — étape 0 (tests) non satisfaite
