# 📈 JOURNAL DE PROGRESSION

> Une entrée par session, la plus récente en haut.
> Format imposé : Date · Fonctionnalités terminées · Fichiers modifiés ·
> Tests exécutés · Problèmes rencontrés · Étape suivante.

---

## 2026-07-28 — Session 11 : branchement de BackupManager (étape 5)

**Date** : 2026-07-28 · **Branche** : `arena/019fa5ec-mobilecaisse`

### Livré
- **BUG-025** *(découvert en lisant le code)* : `generateCustomerStatement`
  utilisait l'autorité `.provider` au lieu de `.fileprovider`. Crash garanti au
  partage d'un relevé client. Les 5 appels `getUriForFile` sont désormais cohérents.
- **B-157** : protocole de vérification manuelle des 6 chemins de sauvegarde
  (avant/après). Lève l'objection ❌ bloquante de l'Expert QA.
- **B-141** : `BackupFormat.detect()` par **signature binaire** — un ZIP renommé
  `.db` reste détecté comme chiffré (risque R1). 9 tests.
- **B-101 / BUG-017** : `BackupManager` branché sur A, B, C.
  - Repository : `exportEncryptedBackup`, `importEncryptedBackup`,
    `peekBackupMetadata`, `shareBackupFile`, `DATABASE_VERSION`.
  - ViewModel : `BackupUiState` scellé, opérations sur `Dispatchers.IO`.
  - UI : `BackupPasswordDialog` partagé (B-142) + avertissement non
    contournable (B-143).
  - **`ClosureScreen.backupDatabase()` supprimée** : accès fichier depuis un
    Composable et export non chiffré.
- Chemins D et E laissés en format brut : sans interface, aucun mot de passe
  saisissable.

### Fichiers modifiés
```
A utils/BackupFormat.kt + BackupFormatTest.kt (9 tests)
A ui/components/BackupPasswordDialog.kt
A .ai/CHECKLISTS/verification_sauvegarde.md
M data/repository/MainRepository.kt   (+150 lignes)
M ui/viewmodel/MainViewModel.kt       (BackupUiState + 4 fonctions)
M ui/screens/SettingsScreen.kt · ClosureScreen.kt · RestorationWizardScreen.kt
M .ai/BUGS.md · BACKLOG.md · CURRENT_TASK.md
```

### Tests exécutés
Aucun build. Passe §19.7 sur 7 fichiers : délimiteurs équilibrés, imports
vérifiés, aucune API interdite. **0 cause racine anticipée.**

### Blocage
⛔ **9 bugs en `CORRIGÉ (INSPECTION)`.** Sans compilation, poursuivre la roadmap
fonctionnelle reviendrait à empiler du code non vérifié — le défaut même qui a
produit `BackupManager`.

### Étape suivante
`make validate`, puis étape 6 (retrait de l'ancien mécanisme) et B-070.

## 2026-07-28 — Session 10 : gel du framework (§20) + B-013/B-140

**Date** : 2026-07-28 · **Branche** : `arena/019fa5ec-mobilecaisse`

### Framework gelé
- **§20** : toute nouvelle règle doit démontrer son retour sur investissement
  (7 questions). Si le bénéfice n'excède pas clairement le coût, **pas d'ajout**.
  §20.2 privilégie **l'outil sur la règle** ; §20.3 interdit les règles par
  anticipation ; §20.4 impose de chercher ce qui peut être supprimé.
- **§20 s'est appliquée à elle-même** : les 7 questions sont renseignées dans le
  document. Verdict : bénéfice supérieur au coût, adoptée.
- **Contrepoids** : §17 (rétrospective) est **subordonnée à §20** — une
  rétrospective ne peut plus engendrer de règle sans passer le test.
- **Indicateur retenu** : 4 394 lignes de `.ai/` pour 12 594 de code (35 %).
  Seuil de vigilance inscrit dans la règle.

### Code livré
- **B-013 / BUG-011** — `checkpointWal()` : `PRAGMA wal_checkpoint(FULL)` avant
  copie, **échec explicite** si le checkpoint est bloqué. Copie via `.tmp`
  renommé : une interruption ne remplace jamais une sauvegarde valide par une
  sauvegarde partielle.
- **B-140 / B-156 / BUG-024** — restauration : copie intégrale vers
  `cacheDir/restore_staging.db` + vérification de taille **avant** `db.close()`.
  Purge des `-wal`/`-shm` de l'ancienne base, qui corrompraient la restaurée.
- **Conséquence** : l'objection ❌ bloquante de l'Expert Room (débat du
  2026-07-28) est **levée**. Reste B-157 (protocole QA) avant branchement.

### Fichiers modifiés
```
M app/src/main/java/.../data/repository/MainRepository.kt   (+80 lignes)
M .ai/CODING_RULES.md §20 · BUGS.md · BACKLOG.md · CURRENT_TASK.md
A .ai/REPORTS/analyse_erreurs_2026-07-28_b013.md
```

### Tests exécutés
Aucun build. **Passe pré-compilation (§19.7)** sur le nouveau code : 4 points
vérifiés (`RoomDatabase.query`, `Cursor.use`, `FileChannel.use`, interpolation),
**0 cause racine anticipée**. Précédent confirmé : `SmsSyncManager:30` utilise
déjà `cursor?.use {}`.

### Problèmes rencontrés
Aucun. Le code s'appuie sur des motifs déjà présents dans le projet.

### Rétrospective *(§17, subordonnée à §20)*
- **A bien fonctionné** : la passe §19.7 est devenue un réflexe peu coûteux
  (~5 min) et a confirmé l'absence de risque avant de solliciter un build.
- **A ralenti** : rien.
- **Nouvelle règle ?** ❌ **Non** — et c'est désormais la réponse attendue par
  défaut. §20 a été ajoutée sur demande explicite, non par anticipation.

### Étape suivante
`make validate`. Puis B-157, puis branchement de `BackupManager`.

## 2026-07-28 — Session 9 : traitement des erreurs par cause racine (§19)

**Date** : 2026-07-28 · **Branche** : `arena/019fa5ec-mobilecaisse`

### Fonctionnalités terminées
- **`CODING_RULES.md` §19** : ne jamais s'arrêter à la première erreur · classer
  par cause racine · distinguer les dérivées · corriger ensemble les causes
  indépendantes · ne recompiler qu'après traitement complet · rapport obligatoire.
- **§19.7 — passe pré-compilation** : quand l'agent ne peut pas compiler,
  anticiper les causes racines par analyse statique. Règle née de son
  application immédiate.
- **`PROMPTS/analyse_resultats_build.md`** mis à jour avec la méthode.

### Application immédiate — 2 causes racines trouvées avant tout build
- **CR-1** : mon `git mv` de la session précédente avait créé un **doublon de
  861 Ko** (`brand_logo.png` en plus de `app_logo.png`). Erreur **dérivée** : les
  `ic_launcher.xml` référencent `@drawable/app_logo` — nettoyer le mauvais
  fichier plus tard aurait cassé l'icône de l'application. ✅ corrigé.
- **CR-2** : mon propre test `aucune API superieure a l API 24` **aurait
  échoué**. Il cherchait `"java.time."` dans tout le fichier, or mes commentaires
  citent cette API pour expliquer pourquoi elle est bannie. Le test analysait
  donc sa propre documentation. ✅ corrigé — analyse du code seul (commentaires
  et KDoc retirés), vérifiée par simulation : 4/4 motifs absents.

### 3 faux positifs écartés
- `R.drawable.ic_dialog_*` → ce sont des `android.R.drawable.*` (ressources système) ;
- accolade déséquilibrée dans le test → quantificateurs d'une regex ISO-8601 en
  chaîne triple-quote ; la classe est correctement fermée ligne 457 ;
- `AppCompat` dans `themes.xml` → uniquement dans un commentaire explicatif.

### Fichiers modifiés
```
D app/src/main/res/drawable-nodpi/brand_logo.png   (doublon 861 Ko)
M app/src/test/.../BackupManagerTest.kt            (CR-2)
M .ai/CODING_RULES.md §19 · PROMPTS/analyse_resultats_build.md · CURRENT_TASK
A .ai/REPORTS/analyse_erreurs_2026-07-28_pre_compilation.md
```

### Tests exécutés
Aucun build. Vérification par **simulation Python** de la logique du test CR-2 :
4/4 motifs interdits absents du code après filtrage des commentaires.

### Problèmes rencontrés
1. **Mes propres outils d'analyse produisent des faux positifs.** Le compteur de
   délimiteurs ne gérait ni l'interpolation `${...}` ni les quantificateurs de
   regex en chaîne triple-quote. Corrigé au fil de l'analyse — et c'est
   précisément pourquoi §19 impose de **vérifier** avant de conclure.
2. **CR-1 est une erreur que j'ai moi-même introduite** à la session précédente.
   Un `git mv` vers un nom différent duplique au lieu de renommer lorsque la
   cible n'existait pas encore sous ce nom.

### Rétrospective *(§17)*
- **A bien fonctionné** : la passe pré-compilation a trouvé une erreur que
  j'avais introduite et un test qui se contredisait lui-même — sans compilateur.
- **A ralenti** : rien ; ~15 min pour économiser ≈ 2 cycles de build.
- **Erreur évitable** : CR-1, en vérifiant le résultat de `git mv` sur le coup.
- **Nouvelle règle ?** ❌ Non. §19 couvre le cas. Conformément au mode
  développement, aucune règle supplémentaire.

### Étape suivante
`make validate`. À réception : classement §19, correction groupée des causes
indépendantes, une seule recompilation, puis rapport §19.6.

## 2026-07-28 — Session 8 : J0 terminé + pinSalt corrigé (mode développement)

**Date** : 2026-07-28 · **Branche** : `arena/019fa5ec-mobilecaisse`

### Changement de cap
Le développement devient la priorité ; le framework n'évolue plus que sur
incident réel. **Une seule règle ajoutée** (§18, classification des
propositions), puis passage immédiat au code.

### Fonctionnalités terminées — 11 tâches
- **B-003** *(le déblocage)* : `MainActivity` étend `ComponentActivity` ;
  `themes.xml` hérite de `@android:style/Theme.Material.Light.NoActionBar`,
  thème de la **plateforme** (API 21+). **Zéro dépendance ajoutée** — ni
  AppCompat, ni Material Components. 🔍 *Observé* : aucun usage fonctionnel
  d'AppCompat n'existait, `Theme.kt` pilotait déjà tout le style.
- B-001 `gradlew` exécutable · B-002 `proguard-rules.pro` · B-004 catalog ·
  B-006 `configuration-cache=false` + Kotlin in-process ·
  B-007/008 nettoyage (28 fichiers dé-versionnés) · B-100 `README.md`
- **B-110** : « Exporter et partager » — libellés, chooser, `logAction`, nom de
  fichier. Noms de fonctions internes **inchangés** (consigne explicite).
- **B-125 / BUG-022** : `MIGRATION_25_26` alignée sur `StaffEntity` —
  `pinSalt TEXT` nullable, `phone` ajouté, `permissions`/`createdAt` supprimés.
- **§18** : classification Bloquante / Critique / Importante / Confort /
  Cosmétique. Seules les deux premières interrompent la roadmap.

### Décision d'ordonnancement
J0 a été remonté **avant** la validation de `BackupManager`. 🧠 *Déduit* :
BUG-003 empêchait la compilation du module entier, donc l'exécution des 26
tests. Traiter J0 d'abord était le chemin le plus court vers l'étape 1.

### Fichiers modifiés
```
M MainActivity.kt · themes.xml · app/build.gradle.kts · gradle.properties
M AppDatabase.kt (MIGRATION_25_26) · MainRepository.kt · SettingsScreen.kt
M MaintenanceScreen.kt · .gitignore · gradlew (mode +x)
A README.md · app/proguard-rules.pro
R app/logo.png → app/src/main/res/drawable-nodpi/brand_logo.png
D conversation.txt + 28 fichiers .idea/ et .kotlin/ dé-versionnés
M .ai/ : BUGS, BACKLOG, CODING_RULES §18, CURRENT_TASK, opportunites
A .ai/REPORTS/analyse_impact_2026-07-28_j0_build.md (niveau L/S, allégée)
```

### Tests exécutés
Aucun — ni Docker ni JDK côté agent. 🔨 compilation **non prouvée** ·
🧪 tests **non exécutés**. Statut de tous les correctifs :
**`CORRIGÉ (INSPECTION)`**.

### Problèmes rencontrés
1. **Choix du thème de remplacement** : `Theme.Material3` aurait exigé
   `com.google.android.material`, soit une dépendance nouvelle pour un thème qui
   ne sert qu'à l'écran système de démarrage. Le thème plateforme évite cela.
2. **`git rm --cached` sur `.idea/`** : les fichiers restent sur le disque du
   développeur, seul l'index est nettoyé — comportement voulu.

### Rétrospective *(§17)*
- **A bien fonctionné** : l'analyse d'impact **allégée** (niveau L) a pris 5 min
  contre ~40 min au niveau C. La proportionnalité §15.0 tient ses promesses.
- **A ralenti** : rien de notable. 11 tâches livrées dans la session.
- **Erreur évitable** : aucune.
- **Nouvelle règle nécessaire ?** ❌ **Non.** Conformément à la nouvelle
  directive, aucune règle n'est ajoutée sans incident réel le justifiant.
  §18 a été ajoutée sur demande explicite, pas par anticipation.

### Étape suivante
`make validate`. Si la compilation passe, les 26 tests de `BackupManager`
s'exécuteront **pour la première fois**. Puis B-013 et B-157 avant branchement.

## 2026-07-28 — Session 7 : Phase 7 (conception, débat, opportunités)

**Date** : 2026-07-28 · **Branche** : `arena/019fa5ec-mobilecaisse`

### Fonctionnalités terminées
- **`CODING_RULES.md` §15** — workflow des évolutions importantes, avec en tête
  la **grille de proportionnalité T/L/S/C** : la profondeur d'analyse suit
  l'impact, jamais la taille du diff. Une correction de typo ne déclenche rien ;
  un correctif d'une ligne sur la crypto déclenche tout.
- **§15.1 conception** (3 solutions minimum, réellement différentes),
  **§15.2 débat** (10 rôles, désaccords attendus), **§15.3 opportunités**
  (proposées, jamais implémentées d'office).
- **§16 honnêteté technique** — 6 catégories d'affirmation :
  🔍 observé · 🔨 compilé · 🧪 testé · ▶️ exécuté · 🧠 déduit · ❓ hypothèse.
- **§17 amélioration permanente** + `PROCESS_IMPROVEMENTS.md`, avec un
  **contrepoids anti-inflation** : toute règle ajoutée oblige à chercher laquelle
  peut être fusionnée ou supprimée.
- **3 modèles** : conception, débat, opportunités.
- **Application intégrale au cas réel** (branchement `BackupManager`, niveau C) :
  4 rapports produits.

### Ce que la Phase 7 a produit concrètement
- **Conception** : 4 solutions comparées. La solution A (tout migrer) aurait
  **violé la décision D2-C** en dérivant la clé du `managerCode` — exactement le
  défaut corrigé sur SQLCipher. Écartée sur cet argument.
- **Débat** : 3 pour, 5 réservés, **2 contre bloquants** (Room, QA). Deux
  exigences intégrées comme prérequis plutôt qu'écartées.
- **BUG-024 découvert** : fenêtre de concurrence pendant la restauration.
- **Opportunités** : 13 améliorations, dont 5 duplications de `ACTION_SEND` et
  deux implémentations concurrentes de l'export CSV.
- **14 tâches ajoutées** (B-145 → B-158), aucune implémentée.

### Fichiers modifiés
```
M .ai/CODING_RULES.md      §15, §16, §17
A .ai/PROCESS_IMPROVEMENTS.md
A .ai/REPORTS/MODELE_analyse_conception.md
A .ai/REPORTS/MODELE_debat_technique.md
A .ai/REPORTS/MODELE_opportunites.md
A .ai/REPORTS/analyse_conception_2026-07-28_branchement_backupmanager.md
A .ai/REPORTS/debat_technique_2026-07-28_branchement_backupmanager.md
A .ai/REPORTS/opportunites_2026-07-28_sauvegarde.md
M .ai/BUGS.md (BUG-024), BACKLOG.md (B-145→B-158), README.md,
  REPORTS/README.md, PROMPTS/session_start.md, CURRENT_TASK.md
```
Aucun code de production modifié.

### Tests exécutés
Aucun nouveau. 🔍 logique du format démontrée (16/16) · 🔨 compilation **non
prouvée** · 🧪 26 tests **non exécutés**.

### Problèmes rencontrés
1. 🔴 **J'ai inscrit une objection fausse dans le débat** : « le singleton
   `AppDatabase` n'est pas invalidé après restauration ». Vérification faite :
   `getDatabase()` gère le cas (`AppDatabase.kt:138-142`). Corrigé, **trace
   conservée**. Le vrai défaut est ailleurs (concurrence) → BUG-024.
   La règle §16 a fonctionné exactement comme prévu.
2. **Coût du processus** : zéro ligne de code produite cette session. Justifié
   au niveau C, intenable en dessous — d'où la grille §15.0, écrite en même
   temps que la règle qu'elle tempère.

### Rétrospective *(§17)*
Consignée dans `PROCESS_IMPROVEMENTS.md`.
- **A bien fonctionné** : le débat a produit un défaut réel invisible en trois
  lectures ; l'obligation de trois solutions a corrigé mon biais initial
  (je voulais brancher directement).
- **A ralenti** : ~40 min pour dix rôles argumentés. Rentable au niveau C seulement.
- **Erreur évitable** : l'objection non vérifiée → **règle R1** ajoutée à §15.2
  (toute objection conduisant à une entrée `BUGS.md` doit être vérifiée,
  commande à l'appui). Insérée comme une phrase, pas comme une section
  supplémentaire — application du contrepoids anti-inflation.
- **Contrepoids proposé (R2)** : clarifier le recouvrement entre
  `MODELE_rapport_analyse` (exploratoire) et `MODELE_analyse_conception`
  (décision d'implémentation).

### Étape suivante
Résultats de `make verify` et `./docker/scripts/test.sh "*BackupManager*"`.
Puis prérequis B-013 et B-157 avant l'étape 5.
Arbitrage demandé sur **B-155** (double saisie du mot de passe).

## 2026-07-28 — Session 6 : règle d'analyse d'impact (§14) et première application

**Date** : 2026-07-28 · **Branche** : `arena/019fa5ec-mobilecaisse`

### Fonctionnalités terminées
- **`CODING_RULES.md` §14 — Analyse d'impact obligatoire** : les 9 questions
  imposées, exigence de réponses **fondées sur des commandes exécutées** (pas
  sur la mémoire), points de contrôle propres au projet, analyse post-correction,
  et grille de proportionnalité (§14.5) pour ne pas alourdir les modifications
  triviales.
- **Deux modèles** : `MODELE_analyse_impact.md` et
  `MODELE_analyse_impact_post_correction.md`.
- **Propagation** : `avant_commit.md` (§0bis), `avant_pull_request.md` (§1bis),
  `PROMPTS/correction_bug.md` (étape 0), `PROMPTS/nouvelle_fonctionnalite.md`
  (étape 2bis), `session_start.md`, `README.md`, `REPORTS/README.md`.
- **Première application réelle** : analyse d'impact complète du branchement de
  `BackupManager` (B-101), rédigée **avant** toute modification.

### La règle a immédiatement produit de la valeur
L'analyse a mis au jour **six éléments qui auraient été découverts trop tard** :

1. 🔴 **R8** — BUG-011 (checkpoint WAL) non corrigé rend l'étape 6 dangereuse :
   supprimer l'ancien mécanisme laisserait un unique chemin de sauvegarde
   potentiellement incohérent. **B-013 reclassé en prérequis.**
2. 🔴 **R2** — `MainRepository.restoreDatabase` appelle `db.close()` **avant** la
   copie : un échec laisse l'application sans base. → restauration en fichier
   temporaire (B-140).
3. 🔴 **R1** — rien ne distingue une archive `.zip` d'un `.db` legacy → risque de
   corruption (B-141).
4. ❌ **QA** — aucun test ne couvre les 5 chemins de sauvegarde actuels : le
   branchement se ferait sans filet côté intégration.
5. 🔴 Les chemins **D** (`SetupScreen`) et **E** (`BackupWorker`) sont
   **structurellement inéligibles** : exécution sans interface, donc sans mot de
   passe. Deux formats coexisteront nécessairement (B-144).
6. ⚠️ `MainViewModel` étant unique et partagé par ~30 écrans, aucune signature
   existante ne peut être modifiée à l'étape 5.

**Conclusion de l'analyse : « développement : NON »** — étapes 3–4 non terminées.
La règle a donc aussi joué son rôle de garde-fou sur moi-même.

### Fichiers modifiés
```
M .ai/CODING_RULES.md          §14
A .ai/REPORTS/MODELE_analyse_impact.md
A .ai/REPORTS/MODELE_analyse_impact_post_correction.md
A .ai/REPORTS/analyse_impact_2026-07-28_branchement_backupmanager.md
M .ai/CHECKLISTS/avant_commit.md, avant_pull_request.md
M .ai/PROMPTS/correction_bug.md, nouvelle_fonctionnalite.md, session_start.md
M .ai/README.md, REPORTS/README.md, BACKLOG.md (B-140→B-144), CURRENT_TASK.md
```
Aucun code de production modifié.

### Tests exécutés
Aucun nouveau. État inchangé : logique du format démontrée (16/16), compilation
et tests Kotlin **toujours non prouvés**.

### Problèmes rencontrés
1. **Le risque R2 était invisible sans analyse systématique.** `db.close()` suivi
   d'une copie qui échoue laisse l'application sans base : j'avais lu ce code
   deux fois lors de l'audit sans en mesurer la portée. C'est la question 8
   (« risques de régression ») qui l'a fait apparaître.
2. **Chemins D et E** : j'avais déjà noté qu'ils ne pouvaient pas recevoir de mot
   de passe, mais la question 5 (Workers/Services) a transformé cette remarque en
   contrainte de conception assumée et documentée.

### Étape suivante
Réception des résultats de `make verify` et
`./docker/scripts/test.sh "*BackupManager*"`, puis application de
`PROMPTS/analyse_resultats_build.md`. Le développement de l'étape 5 ne
commencera qu'après validation, et devra intégrer B-013, B-140 et B-141.

## 2026-07-28 — Session 5 : distinction démontré / hypothèse

**Date** : 2026-07-28 · **Branche** : `arena/019fa5ec-mobilecaisse`

### Fonctionnalités terminées
- **Correction de ma propre terminologie.** J'avais marqué BUG-018 à BUG-023
  « CORRIGÉ », alors que ni la compilation ni les tests Kotlin n'avaient été
  exécutés. Requalifiés en **`CORRIGÉ (INSPECTION)`**.
- **Nouvelle échelle de statuts** dans `BUGS.md` : `CORRIGÉ (INSPECTION)`
  (correctif écrit, non exécuté — dette de vérification) vs
  `CORRIGÉ (VALIDÉ)` (compilation + tests + aucune régression).
  Un bug ne peut plus passer directement de `OUVERT` à `VALIDÉ`.
- **`CODING_RULES.md` §13 — Définition de « terminé »** : règle de validation
  obligatoire, tableau des formulations interdites/exigées, conduite à tenir en
  cas d'échec, et **§13.6 double validation** des composants critiques avec
  tableau de suivi (crypto, SmsParser, FeeCalculator, SecurityUtil, migrations,
  LicenseUtil).
- **Propagation** : `MISSION.md` §6, `CHECKLISTS/avant_commit.md` (§8ter),
  `README.md` (règles d'or), `PROMPTS/session_start.md`.
- **`PROMPTS/analyse_resultats_build.md`** : procédure en 4 étapes pour traiter
  les résultats de build, avec les points de vigilance déjà identifiés sur
  `BackupManager` (7 risques localisés) et la règle « un test qui échoue est une
  information » — interdiction explicite d'affaiblir une assertion pour obtenir
  du vert.

### Fichiers modifiés
```
M .ai/BUGS.md                  échelle de statuts + 5 bugs requalifiés
M .ai/CODING_RULES.md          §13 (dont §13.6 double validation)
M .ai/MISSION.md               §6
M .ai/CHECKLISTS/avant_commit.md   §8ter
M .ai/README.md                règles d'or
M .ai/PROMPTS/session_start.md
A .ai/PROMPTS/analyse_resultats_build.md
M .ai/CURRENT_TASK.md
```
Aucun code de production modifié.

### Tests exécutés
Aucun nouveau. État inchangé et assumé :
- ✅ `verify_backup_format.py` — 16/16 (logique du format, **démontrée**)
- ❌ compilation Kotlin — **non prouvée**
- ❌ 26 tests Kotlin — **non exécutés**
- ❌ compatibilité API 24 réelle — **non prouvée**

### Problèmes rencontrés
1. **Mon propre biais de complétude.** Avoir écrit un correctif argumenté et
   validé sa logique par un harnais indépendant m'a conduit à écrire
   « CORRIGÉ ». C'est précisément l'erreur qui a produit `BackupManager` : un
   module livré comme fonctionnel, jamais compilé. La règle §13 existe pour
   rendre cette confusion structurellement impossible.
2. **Limite de la validation indépendante** : le harnais Python valide le
   *format*, pas le *code Kotlin livré*. Les deux peuvent diverger — d'où
   l'exigence des deux validations, explicitée en §13.6.

### Étape suivante
Réception des sorties de `make verify` et `./docker/scripts/test.sh
"*BackupManager*"`, puis application de `PROMPTS/analyse_resultats_build.md`.

## 2026-07-28 — Session 4 : réparation de BackupManager (étapes 1–2 du nouvel ordre)

**Date** : 2026-07-28 · **Branche** : `arena/019fa5ec-mobilecaisse`

### Fonctionnalités terminées
- **BUG-023 découvert avant tout le reste** : `BackupManager` **ne compilait pas**.
  `exportBackupWithPassword` déclarait `Result<Unit>` alors que
  `runCatching { … ; Result.success(Unit) }` produit `Result<Result<Unit>>`.
  Preuve définitive que ce fichier n'a jamais été compilé.
- **Réécriture complète du module** (format d'archive **v2**) :
  - BUG-018 — suppression de la gestion manuelle du tag GCM ;
  - BUG-019 — base chiffrée par la clé du mot de passe, **en flux** (8 Ko) ;
  - BUG-020 — `Instant.now()` **et** `readAllBytes()` (API 33, non repéré à
    l'audit) remplacés par des API disponibles depuis l'API 1 ;
  - BUG-021 — `databaseVersion` fourni par l'appelant.
- **Renforcements** : manifeste authentifié via l'**AAD** (une altération du
  nombre d'itérations PBKDF2 invalide l'archive), checksum SHA-256 vérifié après
  déchiffrement, suppression des fichiers partiels en cas d'échec,
  `peekMetadata()`, écart d'identité signalé sans blocage.
- **26 tests unitaires** couvrant les 5 garanties demandées.
- **Harnais de validation indépendant** `tools/verification/verify_backup_format.py` :
  réimplémentation Python du format — **16/16 contrôles réussis**.

### Fichiers modifiés
```
M app/src/main/java/com/reconsiliation/caisse/utils/BackupManager.kt   (réécrit)
A app/src/test/java/com/reconsiliation/caisse/utils/BackupManagerTest.kt  (26 tests)
A tools/verification/verify_backup_format.py + README.md
M app/build.gradle.kts        (commentaire seul — aucune dépendance ajoutée)
M .ai/BUGS.md, BACKLOG.md, CURRENT_TASK.md, PROGRESS.md
```
Aucun écran ni ViewModel modifié : le branchement viendra après validation.

### Tests exécutés
- ✅ **Harnais Python : 16/16** — aller-retour, mauvais mot de passe, base non
  lisible en clair, altérations base/métadonnées/manifeste détectées, nonce
  unique, `databaseVersion = 28`, **BUG-018 reproduit puis corrigé**.
- ✅ Contrôles structurels Kotlin : délimiteurs équilibrés, 26 `@Test`.
- ❌ **Tests Kotlin non exécutés** : ni Docker ni JDK dans l'environnement de
  l'agent. **Exécution par le responsable requise.**

### Problèmes rencontrés
1. **Le module ne compilait pas** (BUG-023) — invalide l'hypothèse selon
   laquelle `BackupManager` était « écrit mais seulement pas branché » : il était
   aussi syntaxiquement invalide.
2. **Second défaut de compatibilité non repéré à l'audit** : `readAllBytes()`
   exige l'API 33. Le test d'analyse du source empêche désormais sa réapparition.
3. **Impossible d'exécuter les tests Kotlin** → contourné par une seconde
   implémentation indépendante en Python, qui valide la logique du format mais
   **ne remplace pas** l'exécution réelle.
4. `javax.xml.bind` utilisé initialement comme oracle Base64 : supprimé du JDK
   depuis la version 11. Remplacé par les vecteurs de la RFC 4648.

### Étape suivante
`./docker/scripts/test.sh "*BackupManager*"` — attendu 26/26.
Puis étape 5 : branchement sur les chemins A, B et C.
Aucun branchement avant tests verts (consigne explicite).

## 2026-07-28 — Session 3 : Phase 6, environnement Docker

**Date** : 2026-07-28 · **Branche** : `arena/019fa5ec-mobilecaisse`

### Fonctionnalités terminées
- **Analyse de valeur préalable** (demandée) : Docker évalué étape par étape.
  Retenu pour compilation, tests unitaires, qualité, packaging.
  **Écarté avec justification** pour l'instrumentation et l'émulateur.
  Argument décisif trouvé dans le dépôt : `.kotlin/errors/*.log` révèle
  **3 versions de Kotlin** (2.0.21, 2.2.10) contre 2.1.0 déclarée — preuve
  matérielle que le projet a été bâti depuis des environnements divergents.
- **Contrainte critique identifiée** : `gradle/gradle-daemon-jvm.properties`
  impose `toolchainVersion=21` → **JDK 21 obligatoire**, alors que le code cible
  `jvmTarget = 11`. Une image JDK 17 aurait échoué.
- **`docker/` créé** : Dockerfile (JDK 21 Temurin, SDK 35, build-tools 35.0.0,
  bundletool, ktlint, detekt, jacococli, git), 3 fichiers compose
  (socle / dev / test+sandbox), 13 scripts, `.dockerignore`, README.
- **`Makefile`** à la racine : 16 cibles (`make help`).
- **`.ai/DEV_ENVIRONMENT.md`** : analyse de valeur, architecture, usage,
  exception instrumentation, rapports, dépannage, interaction avec les défauts connus.
- **Intégration au framework** : `avant_commit.md` (étape 0 « environnement
  validé » + étape 8bis « chaîne complète »), `avant_pull_request.md` (§0
  preuves de validation), `ANDROID_RULES.md` (§9bis), `README.md`,
  `PROMPTS/session_start.md` (étape 0), `BACKLOG.md` (P6), `ROADMAP.md` (jalon D).

### Décisions de conception notables
- **Le code n'est pas copié dans l'image** : contexte de build limité à
  `docker/`, dépôt monté en volume ⇒ modifier le code ne reconstruit jamais l'image.
- **Gradle n'est pas installé** : le wrapper télécharge la version exacte (9.5.0).
  Installer un Gradle système recréerait la divergence à éliminer.
- **Kotlin non installé en binaire système** : fourni par le plugin Gradle 2.1.0.
- **`sh ./gradlew`** partout : contourne B-001 sans modifier de fichier monté.
- **`kotlin.compiler.execution.strategy=in-process`** : neutralise les échecs de
  daemon Kotlin observés dans `.kotlin/errors/`.
- **`configuration-cache=false`** en profil test : contourne B-006.

### Fichiers modifiés
Aucun code de production. Créations :
```
docker/Dockerfile, .dockerignore, README.md
docker/docker-compose{,.dev,.test}.yml
docker/scripts/*.sh                       (13 scripts, tous `bash -n` OK)
Makefile
.ai/DEV_ENVIRONMENT.md
```
Mises à jour : `.ai/README.md`, `ANDROID_RULES.md`, `BACKLOG.md`, `ROADMAP.md`,
`CURRENT_TASK.md`, `CHECKLISTS/avant_commit.md`, `CHECKLISTS/avant_pull_request.md`,
`PROMPTS/session_start.md`.

### Tests exécutés
- ✅ `bash -n` sur les **13 scripts** — aucune erreur de syntaxe.
- ❌ **Image jamais construite, chaîne jamais exécutée** : `docker: command not
  found` dans l'environnement de l'agent. Conformément à D4, la première
  exécution revient au responsable.

### Problèmes rencontrés
1. **Docker indisponible côté agent** → livraison vérifiable syntaxiquement
   seulement. Signalé explicitement dans `DEV_ENVIRONMENT.md` §10.
2. **Couverture non mesurable en l'état** : `jacococli` est dans l'image, mais la
   collecte exige un **plugin Gradle JaCoCo** absent du projet. Le rapport le
   signale au lieu d'inventer un chiffre (B-136).
3. **ktlint/detekt ne bloquent pas encore la chaîne** : sans ligne de base, le
   code n'ayant jamais été formaté, tout bloquer stopperait chaque build (B-135).
4. **BUG-003 fera échouer `make validate`** — anticipé et documenté comme
   résultat attendu.

### Étape suivante
**B-133 (responsable)** : `make image && make verify`, puis transmission de la
sortie. Ensuite, file d'attente de `CURRENT_TASK.md` : réparation de
`BackupManager` → branchement → `pinSalt` → J0 → J1.

Deux arbitrages restent en attente (réparation de `BackupManager` avant
branchement ; portée de la correction BUG-019).

## 2026-07-28 — Session 2 : décisions D1–D4 et révision de l'audit

**Date** : 2026-07-28
**Branche** : `arena/019fa5ec-mobilecaisse`

### Fonctionnalités terminées
- **Vérification du code actuel** contre les 5 correctifs de sécurité annoncés
  par le responsable (audit antérieur Copilot + Gemini). Constat déterminant :
  **le dépôt ne contient qu'un seul commit** — le code audité en session 1
  *était déjà* le code post-correctifs.
  - ✅ Confirmés : suppression de `MASTER_EMERGENCY_2024` (0 occurrence),
    retrait de `fallbackToDestructiveMigration` (0 occurrence), clé DB dérivée
    + Keystore + rekey auto/manuel en mode standard (0 occurrence de `x'...'`),
    PIN PBKDF2 + sel + migration paresseuse.
  - ⚠️ Nuance importante : `BackupManager` (PBKDF2 100k + AES-GCM + checksum)
    est bien écrit, mais **n'est appelé par aucun code applicatif**
    → nouveau **BUG-017**.
- **Révision de `BUGS.md`** (rév. 2) : tableau de confirmation des correctifs,
  BUG-004 requalifié 🟠 → 🟡, BUG-001/002/011 re-vérifiés ligne à ligne et
  maintenus, BUG-005 clarifié (distinct de la porte dérobée), BUG-017 ajouté.
- **Découverte** : la migration 25→26 crée `staff.pinSalt TEXT NOT NULL` alors
  que l'entité le déclare nullable — en conflit direct avec le mécanisme de
  migration paresseuse des PIN (correctif n°5).
- **Intégration des décisions D1–D4** dans `ROADMAP.md` (désormais **validée**),
  `BACKLOG.md`, `DATABASE.md`, `SECURITY.md`, `CURRENT_TASK.md`.
- **Rapport d'analyse D2** rédigé : comparatif Google Drive vs Dropbox vs SAF,
  architecture `RemoteBackupStorage`, plan en 7 étapes.

### Fichiers modifiés
Aucun fichier de code de production. Documentation `.ai/` uniquement :
```
.ai/BUGS.md            rév. 2 — confirmations, requalifications, BUG-017
.ai/SECURITY.md        § 0 « correctifs déjà en place », faiblesses requalifiées
.ai/DATABASE.md        § 0 « acquis à ne pas régresser », D1, conflit pinSalt
.ai/BACKLOG.md         B-020/B-021/B-075 clos ; B-101, B-110/111/112 ajoutés
.ai/ROADMAP.md         statut VALIDÉE, décisions D1–D4, J2 allégé
.ai/CURRENT_TASK.md    J0 + B-110
.ai/PROGRESS.md        cette entrée
.ai/REPORTS/rapport_analyse_2026-07-28_sauvegarde_distante.md   (nouveau)
```

### Tests exécutés
Aucun — environnement toujours sans JDK ni SDK Android. Vérifications
**statiques** par `grep` ciblé sur chacun des 5 correctifs annoncés.
Conformément à **D4**, l'exécution des builds et tests revient au responsable ;
je fournis les commandes exactes.

### Problèmes rencontrés
1. **Écart entre l'audit annoncé et l'état du code** : l'audit antérieur
   mentionne une « vérification complète de la chaîne v18→v27 », or la base est
   en **v28** et les 6 divergences migration ⇄ entité subsistent. BUG-001 est
   maintenu, preuves à l'appui (numéros de ligne).
2. **Sécurité écrite mais non branchée** : `BackupManager` est le meilleur code
   de sécurité du dépôt et il est inutilisé. C'est le type de défaut qu'un audit
   par analyse de fichier isolé ne détecte pas.
3. **Incohérence d'itérations PBKDF2** : 5 000 pour les PIN
   (`SecurityUtil`) contre 100 000 pour les sauvegardes (`BackupManager`).

### Étape suivante
**Jalon 0** (décision D3) : build propre + nettoyage technique + B-110
(renommage « Exporter et partager »). Deux arbitrages attendus avant exécution :
- **B-003** : déclarer AppCompat, ou migrer vers `ComponentActivity` + Material3 ?
- **B-110** : renommer les libellés seuls, ou aussi les identifiants Kotlin ?

Puis **J1.1 + J1.2** : `exportSchema = true` et harnais `MigrationTestHelper`.

---

## 2026-07-28 — Session 1 : Audit et mise en place du framework `.ai/`

**Date** : 2026-07-28
**Branche** : `arena/019fa5ec-mobilecaisse`
**Commit de départ** : `1ca7927` (Initial commit)

### Fonctionnalités terminées
- **Phase 1 — Audit complet** du dépôt en lecture seule :
  - 130 fichiers Kotlin, ~12 000 lignes, mono-module `:app` ;
  - cartographie des couches (UI Compose → `MainViewModel` → `MainRepository` → Room/SQLCipher) ;
  - inventaire des 22 entités, 20 DAO, 10 migrations, 33 routes de navigation ;
  - identification de 16 bugs, dont **2 critiques** (migrations Room) ;
  - identification du code mort et des déchets versionnés.
- **Phase 2 — Création du framework de mémoire persistante `.ai/`** :
  17 fichiers Markdown + 4 sous-dossiers (`PROMPTS/`, `CHECKLISTS/`, `REPORTS/`, `LOGS/`),
  tous renseignés à partir du code réel (aucun contenu générique).
- **Phase 3 — `ROADMAP.md`** : 8 jalons ordonnés par dépendances techniques,
  soumise à validation.

### Fichiers modifiés
Aucun fichier de code de production n'a été modifié.
**Créations uniquement**, toutes sous `.ai/` :

```
.ai/README.md                       .ai/BACKLOG.md
.ai/MISSION.md                      .ai/CURRENT_TASK.md
.ai/PROJECT_CONTEXT.md              .ai/PROGRESS.md
.ai/ARCHITECTURE.md                 .ai/BUGS.md
.ai/CODING_RULES.md                 .ai/KNOWN_LIMITATIONS.md
.ai/ANDROID_RULES.md                .ai/DEPENDENCIES.md
.ai/DATABASE.md                     .ai/SECURITY.md
.ai/API.md                          .ai/TEST_PLAN.md
.ai/ROADMAP.md
.ai/PROMPTS/    (session_start, revue_de_code, roles, nouvelle_fonctionnalite, correction_bug)
.ai/CHECKLISTS/ (avant_commit, avant_pull_request, avant_release, migration_room)
.ai/REPORTS/    (README + 5 modèles + rapport d'audit initial)
.ai/LOGS/       (README + journal 2026-07-28)
```

### Tests exécutés
**Aucun.** L'environnement sandbox ne dispose ni de JDK (`java: command not found`)
ni de SDK Android (`ANDROID_HOME` vide), et `gradlew` n'est pas exécutable.
Vérification **statique uniquement** (lecture de code, `grep`, analyse des schémas).
👉 Le jalon 0 de la roadmap traite précisément ce point.

### Problèmes rencontrés
1. 🔴 **Migrations Room incohérentes** avec les `@Entity` (6 tables) → crash
   garanti à la mise à jour sur base existante. Voir BUG-001.
2. 🔴 **Aucune migration sous la version 18** et aucun repli → base ancienne
   irrécupérable. Voir BUG-002.
3. 🟠 **`androidx.appcompat` utilisé mais non déclaré** → build fragile. BUG-003.
4. 🟠 **Secrets en clair** (licence, dérivation de clé) avec R8 désactivé. BUG-004/005.
5. 🟡 Impossible de compiler pour confirmer les hypothèses (environnement non outillé).
6. 🟡 Dépôt pollué : `conversation.txt` (transcript d'un autre outil, package
   `com.rork.momocaisse`), 27 fichiers `.idea/`, logs `.kotlin/`.

### Étape suivante
En attente de validation du responsable sur `ROADMAP.md` :
- ordre des jalons ;
- point de départ : **J0** (build vérifiable) ou **J1.1–1.2** (schémas Room + harnais de test de migration) ;
- décisions produit **1.4** (bases < v18) et **6.7** (nature de la « sync cloud »).

Aucun code ne sera modifié avant cette validation.
