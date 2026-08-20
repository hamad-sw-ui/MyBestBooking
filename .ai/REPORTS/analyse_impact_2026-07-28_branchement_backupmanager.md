# Analyse d'impact — Branchement de `BackupManager` (étapes 5 et 6)

**Date** : 2026-07-28
**Réf.** : B-101 / BUG-017 · **Nature** : refactor + correctif de sécurité
**Composant** : `utils/BackupManager.kt` → chemins A, B, C
**Commit de référence** : `f8dd42c`
**Statut** : ⏸️ **analyse complète — développement suspendu** jusqu'à validation
des 26 tests Kotlin (étapes 3–4 non terminées)

---

## 1. Fichiers utilisant **directement** le composant

```bash
grep -rn "BackupManager" app/src --include=*.kt | grep -v "utils/BackupManager.kt"
# → BackupManagerTest.kt uniquement
```

**Aucun appelant en production** — c'est l'objet même de BUG-017.

Les fonctions à **remplacer** sont en revanche largement appelées :

```bash
grep -rn "backupDatabase\|restoreDatabase\|syncToCloud" app/src --include=*.kt
```

| # | Fichier:ligne | Fonction | Couche |
|---|---|---|---|
| 1 | `SettingsScreen.kt:119` | `viewModel.syncToCloud()` | UI |
| 2 | `ClosureScreen.kt:144` → `:198` | `backupDatabase()` **locale à l'écran** | UI ⚠️ |
| 3 | `RestorationWizardScreen.kt:112` | `viewModel.restoreDatabase()` | UI |
| 4 | `SetupScreen.kt:148` | `repository.restoreDatabase()` | UI ⚠️ |
| 5 | `BackupWorker.kt:23` | `repository.backupDatabase()` | Worker |
| 6 | `BackupWorker.kt:30` | `repository.backupDatabase()` (miroir) | Worker |
| 7 | `MainViewModel.kt:432` | `backupDatabase(file)` | VM |
| 8 | `MainViewModel.kt:433` | `restoreDatabase(file)` | VM |
| 9 | `MainViewModel.kt:463` | `syncToCloud(context)` | VM |
| 10 | `MainRepository.kt:786/801/889` | définitions | Repo |

**10 points d'appel, 4 couches.**

## 2. Composants impactés **indirectement**

```
BackupManager (nouveau)
 └─ MainRepository
      ├─ MainViewModel ──┬─ SettingsScreen          [A]
      │                  ├─ RestorationWizardScreen [C]
      │                  └─ (28 autres écrans partagent ce VM) ⚠️
      ├─ BackupWorker ────── WorkManager (quotidien) [E]
      └─ SetupScreen (instancie son propre repository) [D]

ClosureScreen [B] ── fonction locale, ne passe par aucune couche ⚠️
```

**Effet de bord notable** : `MainViewModel` étant unique et partagé, toute
signature modifiée doit rester **compatible** ou obliger à toucher 30 écrans.
→ *Décision : n'ajouter que de nouvelles fonctions, ne modifier aucune signature
existante lors de l'étape 5.*

## 3. ViewModel impactés

| ViewModel | Fonctions | Signature modifiée ? | État exposé |
|---|---|---|---|
| `MainViewModel` (unique) | `backupDatabase`, `restoreDatabase`, `syncToCloud` | ❌ **non** — ajout de `exportEncryptedBackup(...)`, `importEncryptedBackup(...)`, `peekBackupMetadata(...)` | ➕ `backupState: StateFlow<BackupUiState>` (nouveau, additif) |

Les anciennes fonctions restent en place jusqu'à l'**étape 6**, après validation.

## 4. Écrans impactés

| Écran | Interaction | Modification UI | Parcours affecté |
|---|---|---|---|
| `SettingsScreen` [A] | bouton d'export | ➕ dialogue de **saisie du mot de passe** (D2-C) · libellé « Exporter et partager » (B-110) | export manuel |
| `ClosureScreen` [B] | bouton « Sauvegarde Totale » | ➕ même dialogue · ⚠️ **suppression de la fonction locale**, passage par le VM | clôture de journée |
| `RestorationWizardScreen` [C] | assistant 2 étapes | ➕ **étape mot de passe** entre choix du fichier et confirmation · aperçu via `peekMetadata()` | restauration |
| `SetupScreen` [D] | dialogue miroir | ❌ **inchangé** | premier lancement |

⚠️ `ClosureScreen` et `SettingsScreen` étant des routes MANAGER, le contrôle
d'accès existant reste valable.

## 5. Workers et Services impactés

| Composant | Type | Impact | Contrainte |
|---|---|---|---|
| `BackupWorker` | `CoroutineWorker` | ❌ **inchangé** | 🔴 **aucun mot de passe saisissable en arrière-plan** |
| `SetupScreen` (miroir) | UI | ❌ **inchangé** | 🔴 s'exécute **avant** toute configuration : ni boutique, ni `managerCode` |
| `SubscriptionWorker` | `CoroutineWorker` | ❌ sans rapport | — |
| `SmsReceiver` | `BroadcastReceiver` | ❌ sans rapport | — |

**Conclusion structurante** : les chemins D et E **doivent** conserver la copie
brute. Le fichier reste chiffré par SQLCipher. Vouloir les migrer imposerait de
stocker un mot de passe — exactement ce que la décision D2-C interdit.

⚠️ **Conséquence à documenter dans l'UI** : deux formats de sauvegarde
coexisteront (`.zip` chiffré par mot de passe / `.db` SQLCipher).

## 6. Tests existants couvrant la fonctionnalité

```bash
grep -rln "backupDatabase\|restoreDatabase\|syncToCloud" app/src/test app/src/androidTest
# → aucun résultat
```

| Test | Couvre | Sera cassé ? |
|---|---|---|
| `BackupManagerTest` (26) | le module seul, pas son branchement | non |
| `SecurityMigrationTest` (2) | rekey SQLCipher — **touche la même base** | ⚠️ à revérifier |

🔴 **Aucun test ne couvre les 5 chemins de sauvegarde actuels.** Le branchement
se fera donc sans filet côté intégration : d'où la nécessité des nouveaux tests
et de la vérification manuelle.

## 7. Nouveaux tests à créer

| Test | Type | Prouve | Priorité |
|---|---|---|---|
| `exportEncryptedBackup` produit une archive lisible | unitaire (repo) | chaîne repo → BackupManager | 🔴 |
| `importEncryptedBackup` restaure et rouvre la base Room | **instrumenté** | la base restaurée est exploitable par SQLCipher | 🔴 |
| Mot de passe erroné → `BackupUiState.Error`, base intacte | unitaire | aucune destruction sur échec | 🔴 |
| Détection de format `.zip` vs `.db` legacy | unitaire | rétrocompatibilité | 🟠 |
| `BackupWorker` continue de produire un `.db` brut | unitaire | non-régression chemin E | 🟠 |
| Restauration du miroir au setup inchangée | instrumenté | non-régression chemin D | 🟠 |

## 8. Risques de régression

| # | Risque | Prob. | Grav. | Atténuation |
|---|---|---|---|---|
| R1 | Une archive `.zip` est confondue avec un `.db` → base corrompue | Moyenne | 🔴 | Détection par magie de fichier (`PK\x03\x04`) avant traitement |
| R2 | `restoreDatabase` ferme la base (`db.close()`) puis échoue → app inutilisable | Moyenne | 🔴 | Restaurer dans un fichier temporaire, **ne remplacer qu'après** validation du checksum |
| R3 | L'utilisateur oublie son mot de passe → sauvegarde perdue | **Élevée** | 🔴 | Avertissement explicite et non contournable dans l'UI |
| R4 | Sauvegardes `.db` existantes devenues illisibles | Moyenne | 🟠 | Import rétrocompatible : chemin legacy conservé |
| R5 | Régression de `SecurityMigrationTest` (même base) | Faible | 🟠 | Relancer les tests instrumentés |
| R6 | Chemins D/E cassés par une modification du repository | Moyenne | 🟠 | Ne pas toucher `backupDatabase()` à l'étape 5 |
| R7 | OOM sur gros fichier | Faible | 🟠 | Déjà traité : chiffrement en flux 8 Ko |
| R8 | Copie WAL incohérente (BUG-011, non corrigé) | **Élevée** | 🟠 | ⚠️ **B-013 doit précéder l'étape 6** |
| R9 | `MainViewModel` alourdi (586 l.) | Certaine | 🟡 | Accepté ; découpage prévu en J5 |

🔴 **R8 est bloquant pour l'étape 6** : supprimer l'ancien mécanisme sans avoir
corrigé le checkpoint WAL reviendrait à ne conserver qu'un seul chemin de
sauvegarde, potentiellement incohérent. **B-013 est donc reclassé en
prérequis de l'étape 6.**

## 9. Composants à revérifier après modification

- [ ] `SettingsScreen` — export complet avec saisie de mot de passe
- [ ] `ClosureScreen` — export après clôture ; la fonction locale a disparu
- [ ] `RestorationWizardScreen` — restauration `.zip` **et** `.db` legacy
- [ ] `SetupScreen` — restauration du miroir au premier lancement (inchangée)
- [ ] `BackupWorker` — sauvegarde quotidienne toujours en `.db` brut
- [ ] `MainViewModel` — aucune signature existante modifiée
- [ ] `SecurityMigrationTest` — 2 tests toujours verts
- [ ] `BackupManagerTest` — 26 tests toujours verts
- [ ] Parcours de vente complet — non-régression générale
- [ ] Mode avion — aucune dépendance réseau introduite

---

## 10. Décision

**Périmètre étape 5** : chemins **A, B, C** uniquement. Ajout de fonctions au
repository et au ViewModel, **sans modifier aucune signature existante**.

**Hors périmètre** : chemins D et E (impossible sans mot de passe) ·
suppression de l'ancien mécanisme (étape 6) · découpage du ViewModel (J5).

**Ordre d'exécution** :
1. ✅ étapes 3–4 : tests Kotlin verts ← **prérequis non satisfait**
2. B-013 (checkpoint WAL) — remonté en prérequis à cause de R8
3. Repository : `exportEncryptedBackup`, `importEncryptedBackup` (fichier temporaire, R2)
4. ViewModel : 3 fonctions + `BackupUiState`
5. UI : composant `BackupPasswordDialog` réutilisable, puis A, B, C
6. Tests d'intégration
7. Analyse d'impact post-correction

**Point de non-retour** : la suppression de l'ancien mécanisme (étape 6). Avant
cela, tout est réversible.

## 11. Analyse par rôle

| Rôle | Verdict | Réserve principale |
|---|---|---|
| Architecte | ⚠️ | `ClosureScreen` doit cesser d'accéder au système de fichiers |
| Dev Android senior | ⚠️ | Le dialogue de mot de passe doit survivre à une rotation (`rememberSaveable`) |
| Expert Kotlin | ✅ | `Result` déjà en place, cohérent |
| Expert Room | ⚠️ | R2 : ne jamais fermer la base avant validation du remplacement |
| Expert Compose | ⚠️ | Un seul `BackupPasswordDialog` pour les 3 écrans — pas de triplication |
| Expert Hilt | ⬜ | Sans objet avant J4 |
| Expert SQL | ✅ | Aucune requête modifiée |
| Ingénieur QA | ❌ | **Aucun test ne couvre les chemins actuels** : vérification manuelle obligatoire |
| Expert sécurité | ⚠️ | Le mot de passe ne doit jamais être journalisé ni conservé en `State` après usage |
| Ingénieur DevOps | ✅ | Aucune dépendance ajoutée |
| Relecteur | ⚠️ | Deux formats coexistants : à documenter dans l'UI |

**Un ❌ (QA)** → la vérification manuelle des 4 parcours est **obligatoire**
avant l'étape 6.

---

**Analyse validée le** : 2026-07-28
**Le développement peut commencer** : ☐ oui ☑ **non**
**Motif** : étapes 3–4 non terminées — les 26 tests Kotlin n'ont pas été
exécutés. Deux prérequis nouveaux identifiés par cette analyse : **B-013**
(checkpoint WAL, risque R8) et la **restauration en fichier temporaire**
(risque R2).
