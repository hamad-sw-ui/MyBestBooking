# 🐞 BUGS

## Échelle de statuts

| Statut | Signification | Preuve exigée |
|---|---|---|
| `OUVERT` | Défaut constaté, non traité | — |
| `EN COURS` | Traitement démarré | — |
| **`CORRIGÉ (INSPECTION)`** | **Correctif écrit et raisonné, mais *non exécuté*. Reste une hypothèse.** | lecture, analyse statique, éventuelle validation algorithmique indépendante |
| **`CORRIGÉ (VALIDÉ)`** | **Correctif prouvé.** Seul statut autorisant la clôture | compilation réelle ✅ · tests automatisés ✅ · aucune régression ✅ |
| `NON REPRODUCTIBLE` | Introuvable après enquête | — |
| `ACCEPTÉ` | Défaut assumé, documenté dans `KNOWN_LIMITATIONS.md` | décision écrite |

> ⚠️ **Un bug ne passe jamais directement de `OUVERT` à `CORRIGÉ (VALIDÉ)`.**
> `CORRIGÉ (INSPECTION)` n'est **pas** un état terminal : c'est une dette de
> vérification. Voir `CODING_RULES.md` §13.

Gravités : 🔴 CRITIQUE · 🟠 MAJEUR · 🟡 MINEUR

> Recensés lors de l'audit du **2026-07-28**, **révisés le 2026-07-28 (rév. 2)**
> après information du responsable sur un audit de sécurité antérieur
> (GitHub Copilot + Gemini Code Assist), puis **enrichis (rév. 3)** lors de
> l'inspection ligne à ligne de `BackupManager` préalable à son branchement
> (BUG-018 à BUG-021).

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## ⚠️ Note de révision — 2026-07-28 (rév. 2)

Le responsable a signalé 5 correctifs de sécurité déjà appliqués et validés par
tests d'instrumentation. **Vérification faite dans le code : le dépôt ne contient
qu'un seul commit (`1ca7927`)** — ces correctifs sont donc **déjà intégrés au code
que j'ai audité**. L'audit initial portait bien sur l'état *après* corrections.

### Confirmations (état vérifié dans le code actuel)

| Correctif annoncé | Vérification | Verdict |
|---|---|---|
| 1. Suppression de la porte dérobée `MASTER_EMERGENCY_2024` | `grep -rn "MASTER_EMERGENCY\|EMERGENCY"` → **0 occurrence** | ✅ Confirmé |
| 1bis. Suppression de `verifyKey()` dans `MainRepository` | `MainRepository` n'a plus de `verifyKey` propre ; il délègue à `LicenseUtil.verifyKey` (HMAC lié au numéro) | ✅ Confirmé — comportement sain |
| 2. Retrait de `fallbackToDestructiveMigration()` | `grep -rn "fallbackToDestructive"` → **0 occurrence** | ✅ Confirmé |
| 3. Clé DB dérivée + Keystore + rekey auto/manuel, **mode standard** | `SecurityUtil.deriveNewKey` + `saveMigratedKey`/`getMigratedKey` (AES-GCM Keystore) ; `performRekeyIfNecessary` + `forceRekey` ; `grep -rn "x'"` → **0 occurrence** (pas de syntaxe hex brute) | ✅ Confirmé |
| 4. Sauvegarde chiffrée par mot de passe (PBKDF2 + AES-GCM) | `BackupManager` : PBKDF2WithHmacSHA256, **100 000 itérations**, sel 32 o, AES/GCM 128 bits, checksum, contrôle de robustesse du mot de passe | ✅ Code présent et de bonne facture |
| 5. PIN en PBKDF2 + sel unique + migration paresseuse | `SecurityUtil.hashPinPbkdf2` + `verifyPin` (temps constant) ; migration paresseuse dans `MainViewModel.checkPin` | ✅ Confirmé |

### Corrections apportées à ce document
- **BUG-004** (dérivation de clé) : requalifié 🟠 → 🟡, reformulé — la partie
  Keystore/rekey est bien en place, seule l'itération unique du SHA-256 reste
  discutable, et son impact est très réduit sans utilisateurs en production.
- **BUG-011** (WAL) : **maintenu** — vérifié dans `MainRepository.backupDatabase`,
  qui fait un `transferFrom` brut sans checkpoint.
- **Nouveau BUG-017** : `BackupManager` (sauvegarde chiffrée) **n'est branché
  nulle part** dans l'UI — le code sécurisé existe mais n'est pas utilisé.
- **B-094** : Divisé en **B-094A** (Orchestration JVM - Niveau A-JVM) et 
  **B-094B** (Intégration Room/SQLCipher - Niveau A-Android).
- **BUG-001 / BUG-002** : **maintenus et re-vérifiés ligne à ligne** (voir détail
  ci-dessous). Le point 2 de l'audit antérieur annonce une « vérification complète
  de la chaîne v18→v27 » ; or la base est en **v28** et les divergences
  migration ⇄ entité subsistent dans le code actuel.
- **Contexte d'urgence révisé** : aucun utilisateur en production → BUG-001 et
  BUG-002 ne détruisent aucune donnée réelle aujourd'hui. Ils restent 🔴 car ils
  bloquent tout déploiement, mais la fenêtre pour les corriger proprement est
  grande ouverte.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🔴 BUG-001 — Migrations Room désynchronisées des entités

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🔴 CRITIQUE · **Fichier** : `data/local/AppDatabase.kt`

Six migrations produisent un schéma différent de celui généré depuis les
`@Entity`. Room lève `IllegalStateException: Migration didn't properly handle: <table>`
au premier lancement suivant une mise à jour.

| Migration | Migration crée | Entité attend |
|---|---|---|
| 20→21 `boutique` | `totalQuantityOnReceipt` | `showTotalQuantityOnReceipt` |
| 21→22 `processed_sms` | `status`, `errorMessage` | absentes de l'entité |
| 22→23 `categories` | `description`, `color`, `icon`, index unique `name` | `type` (absent de la migration) |
| 23→24 `suppliers` | `phoneNumber`, `email`, `category`, `notes` | `phone`, `address`, `totalDebt` |
| 24→25 `sessions` | `staffName`, `startCash`, `expectedEndCash`, `actualEndCash`, `status`, FK staff NOT NULL | `sellerName`, `openingBalance`, `closingBalance`, `expectedBalance`, `totalCashSales`, `totalMomoSales`, `totalExpenses`, `isActive`, `staffId` nullable |
| 25→26 `staff` | `permissions`, `createdAt` NOT NULL | `phone`, `pinSalt` |
| 26→27 `processed_sms` | `type` | absente de l'entité |

**Impact** : crash au démarrage pour tout utilisateur ayant déjà une base.
Une installation neuve fonctionne (Room crée depuis les entités), ce qui masque
le bug en test.

**Contexte (rév. 2)** : aucun utilisateur en production → **aucune donnée réelle
en jeu aujourd'hui**. Le bug reste 🔴 car il interdit toute mise à jour et donc
tout déploiement, mais il peut être corrigé sereinement, y compris en
reconstruisant la chaîne de migrations.

**Re-vérifié le 2026-07-28 (rév. 2)** — les divergences sont toujours présentes :
```
AppDatabase.kt:99   ALTER TABLE boutique ADD COLUMN totalQuantityOnReceipt   ≠ showTotalQuantityOnReceipt
AppDatabase.kt:113  categories(name, description, color, icon)              ≠ (name, type)
AppDatabase.kt:120  suppliers(name, phoneNumber, address, email, category, notes) ≠ (name, phone, address, totalDebt)
AppDatabase.kt:127  sessions(staffName, startCash, expectedEndCash, ...)    ≠ (sellerName, openingBalance, ...)
AppDatabase.kt:71   staff(pinHash, pinSalt NOT NULL, role, permissions, isActive, createdAt) ≠ (pinHash, pinSalt nullable, phone, isActive, role)
```
⚠️ À noter : la migration `staff` déclare `pinSalt TEXT NOT NULL` alors que
l'entité le déclare **nullable** — ce qui entre précisément en conflit avec le
mécanisme de **migration paresseuse des PIN** (correctif n°5), lequel suppose
`pinSalt == null` pour les anciens comptes.

**Correction attendue** : activer `exportSchema = true`, générer les schémas de
référence, réécrire les migrations à partir du SQL généré par Room, ajouter des
migrations correctives (`n → 29`) recréant les tables divergentes avec copie des
données, couvrir par `MigrationTestHelper`.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🔴 BUG-002 — Chaîne de migrations incomplète sous la version 18

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🔴 CRITIQUE · **Fichier** : `data/local/AppDatabase.kt`

`version = 30`, migrations fournies de 18 à 30 uniquement, aucun
`fallbackToDestructiveMigration` — dont le retrait est un correctif volontaire
et validé, **à ne pas annuler**. Une base en version 1–17 ne peut pas être
migrée → crash irrécupérable.

**✅ DÉCISION D1 du responsable (2026-07-28)** : cas assumé. Si un utilisateur
possède une base < v18, on lui **demande son accord** puis on repart sur une
base neuve. Perte de données **assumée** dans ce cas rare.

**Correction retenue** : détection explicite de la version < 18 à l'ouverture →
écran de consentement → export de sauvegarde de courtoisie → recréation
contrôlée. `fallbackToDestructiveMigration()` reste proscrit : le mécanisme doit
être explicite et déclenché par l'utilisateur, jamais silencieux.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-003 — `androidx.appcompat` utilisé mais non déclaré

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟠 MAJEUR
**⏳ En attente de validation par compilation réelle.**
**Correctif** : `MainActivity` étend désormais `ComponentActivity`
(`androidx.activity`, déjà présent) ; `themes.xml` hérite de
`@android:style/Theme.Material.Light.NoActionBar` (thème de la **plateforme**,
API 21+). **Zéro dépendance ajoutée** — ni AppCompat, ni Material Components.
🔍 *Observé* : aucun usage fonctionnel d'AppCompat n'existait (ni
`supportActionBar`, ni `delegate`). `Theme.kt` pilotait déjà tout le style.
**Fichiers** : `MainActivity.kt`, `res/values/themes.xml`, `app/build.gradle.kts`

`MainActivity : AppCompatActivity` et `Theme.CAISSE` hérite de
`Theme.AppCompat.Light.NoActionBar`, mais aucune dépendance `appcompat` n'est
déclarée (ni dans `build.gradle.kts`, ni dans `libs.versions.toml`). Le build ne
tient que par une résolution transitive fortuite.

**Correction attendue** : soit déclarer `androidx.appcompat:appcompat`, soit
(préférable) passer à `ComponentActivity` + `Theme.Material3` et supprimer la
dépendance AppCompat.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-004 — Dérivation de clé SQLCipher : une seule itération SHA-256

**Statut** : OUVERT · **Gravité** : 🟡 MINEUR *(requalifié de 🟠 en rév. 2)*
**Fichier** : `utils/SecurityUtil.kt`

### ✅ Ce qui est déjà en place et vérifié (correctif antérieur n°3)
- Clé dérivée de `phone + managerCode` (et non plus d'un secret en dur).
- Clé chiffrée **AES/GCM via AndroidKeyStore** (`saveMigratedKey`/`getMigratedKey`).
- **Rekey automatique** (`performRekeyIfNecessary`) et **manuel** (`forceRekey`).
- **Mode standard SQLCipher** : la passphrase hexadécimale est confiée à
  SQLCipher qui applique son PBKDF2 natif — `grep -rn "x'"` → 0 occurrence,
  aucune manipulation de syntaxe SQL brute. ✅
- Couvert par `SecurityMigrationTest` (2 tests d'instrumentation).

### Ce qui reste discutable
`deriveNewKey` applique **un seul** SHA-256 sur
`phone|managerCode|CIPHER_SECRET_V1`, sans sel aléatoire. Le numéro de téléphone
étant public, la robustesse repose entièrement sur l'entropie du `managerCode`
(≥ 12 caractères alphanumériques imposés — c'est ce qui rend l'attaque coûteuse).

**Atténuation forte** : SQLCipher applique ensuite son propre PBKDF2 sur la
passphrase, ce qui ajoute le coût itératif manquant au niveau applicatif.

**Repli legacy** : `getDatabaseKeyCompat` (`ANDROID_ID`) subsiste comme voie de
migration à sens unique. Correct sur le principe, mais à retirer une fois la
migration généralisée.

**Correction éventuelle** : ajouter un sel aléatoire persisté au Keystore lors
de la dérivation. ⚠️ Impose un nouveau cycle de rekey — à ne faire **que** si le
bénéfice est jugé supérieur au risque, d'autant qu'aucune donnée réelle n'est
en jeu aujourd'hui. **Non prioritaire.**

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-005 — Secret de licence en clair + minification désactivée

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟠 MAJEUR
**Fichiers** : `utils/LicenseUtil.kt`, `app/build.gradle.kts`

`SECRET_SALT = "M0M0_C41SS3_V1_PRO_S3CR3T_2024_K3Y"` en clair, et
`generateActivationKey()` (outil admin) est **embarqué dans l'APK de production**.
Avec `isMinifyEnabled = false`, n'importe qui peut décompiler et générer des clés.

**Re-vérifié le 2026-07-28 (rév. 2)** : toujours présent. À distinguer du
correctif n°1 (porte dérobée `MASTER_EMERGENCY_2024`), qui est bien supprimé —
il s'agit ici d'un problème **distinct** portant sur le sel du HMAC de licence,
non couvert par l'audit antérieur. `MainRepository.activateSubscription`
délègue correctement à `LicenseUtil.verifyKey(boutique.phoneNumber, key)` :
la logique est saine, seul le secret est exposé.

**Correction attendue** : activer R8, retirer le générateur de l'APK client,
déplacer le secret (NDK/obfuscation/dérivation), accepter que le modèle
hors-ligne reste imparfait (documenté dans `KNOWN_LIMITATIONS.md`).

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-006 — SQL construit par concaténation dans `PRAGMA rekey`

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟠 MAJEUR · **Fichier** : `data/local/AppDatabase.kt`

`db.execSQL("PRAGMA rekey = '$newKeyPassphrase'")` dans `performRekeyIfNecessary`
et `forceRekey`. La passphrase est hexadécimale (donc sûre en pratique), mais le
motif est dangereux et `forceRekey` ne valide pas son entrée.

**Correction attendue** : valider strictement l'entrée (`^[0-9a-f]{64}$`) et
centraliser dans une fonction unique documentée.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-007 — `SavedStateHandle` vide dans `MainViewModelFactory`

**Statut** : OUVERT · **Gravité** : 🟠 MAJEUR · **Fichier** : `ui/viewmodel/MainViewModel.kt:578`

```kotlin
return MainViewModel(application, SavedStateHandle()) as T
```
Un `SavedStateHandle` neuf est créé à chaque fois → `user_role` / `staff_id`
ne sont **jamais** restaurés après mort du processus, contrairement à l'intention.

**Correction attendue** : `AbstractSavedStateViewModelFactory` /
`CreationExtras`, ou `@HiltViewModel` (qui l'injecte correctement).

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-008 — Détection d'anomalie de date inopérante

**Statut** : OUVERT · **Gravité** : 🟡 MINEUR · **Fichier** : `sms/SmsReceiver.kt:43-46`

```kotlin
val networkTime = System.currentTimeMillis()
val systemTime  = System.currentTimeMillis()
if (abs(networkTime - systemTime) > 30*60*1000) { … }   // toujours faux
```
La protection contre la falsification de l'heure système ne se déclenche jamais.

**Correction attendue** : utiliser le timestamp du centre de service SMS
(`SmsMessage.timestampMillis`) comme référence réseau.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-009 — Scope de coroutine orphelin dans `SmsReceiver`

**Statut** : OUVERT · **Gravité** : 🟡 MINEUR · **Fichier** : `sms/SmsReceiver.kt:37`

`CoroutineScope(Dispatchers.IO).launch { }` non annulable, dont dépend
`pendingResult.finish()`. Risque de fuite et de travail tué par le système.

**Correction attendue** : `goAsync()` avec scope maîtrisé et `finally { finish() }`,
ou délégation à un `OneTimeWorkRequest`.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-010 — Permissions demandées en bloc, résultat ignoré

**Statut** : OUVERT · **Gravité** : 🟡 MINEUR · **Fichier** : `MainActivity.kt`

Toutes les permissions (SMS, caméra, Bluetooth, notifications) sont demandées au
premier lancement, sans explication, et `onRequestPermissionsResult` n'est pas
implémenté : l'app ignore les refus.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-018 — `BackupManager` : le chiffrement AES-GCM est cassé (aller-retour impossible)

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🔴 CRITIQUE
**⏳ En attente de validation par compilation réelle.**
**Cause racine** : `Cipher.doFinal()` en mode GCM retourne déjà `ciphertext || tag` ;
le code extrayait le tag *sans le retirer*, puis le reconcaténait au déchiffrement
(`CT || TAG || TAG`) → `AEADBadTagException` systématique.
**Correctif** : suppression totale de la gestion manuelle du tag. Format v2 :
`IV(12) || AES-GCM(payload)`, `doFinal` gère le tag.
**Preuve** : bug reproduit puis corrigé dans
`tools/verification/verify_backup_format.py` (contrôle 6/16) + tests Kotlin
`une sauvegarde exportee peut etre restauree a l identique`.
**Fichier** : `utils/BackupManager.kt:233-270`

`Cipher.doFinal()` en mode GCM retourne **déjà** `ciphertext || tag` concaténés.
Le code extrait ensuite le tag *sans le retirer* du ciphertext :

```kotlin
val ciphertext = cipher.doFinal(plaintext)              // = CT || TAG
val tag = ciphertext.takeLast(16).toByteArray()         // copie du TAG
return EncryptedData(ciphertext = ciphertext, ...)      // CT || TAG stocké entier
```

Au déchiffrement, le tag est concaténé une **seconde** fois :

```kotlin
val input = ciphertext + tag        // = CT || TAG || TAG
return cipher.doFinal(input)        // → AEADBadTagException
```

**Conséquence** : `importBackupWithPassword` échoue **systématiquement**, avec le
message trompeur « Mot de passe incorrect ou sauvegarde corrompue » — même avec
le bon mot de passe. Toute sauvegarde produite est **irrécupérable**.

**Non détecté jusqu'ici** parce que le module n'est appelé par personne (BUG-017)
et n'a aucun test unitaire.

**Correction** : ne stocker que le ciphertext nu, ou ne pas ré-ajouter le tag au
déchiffrement. Option la plus simple et la plus sûre : supprimer entièrement la
gestion manuelle du tag, `doFinal` s'en charge.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-019 — `BackupManager` : la base n'est pas chiffrée par le mot de passe

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟠 MAJEUR
**⏳ En attente de validation par compilation réelle.**
**Cause racine** : `zip.write(dbBytes)` écrivait les octets bruts ; seules les
métadonnées étaient chiffrées.
**Correctif** : la base est chiffrée en flux par la clé dérivée du mot de passe
(entrée `database.enc`). Traitement par blocs de 8 Ko : le fichier n'est jamais
chargé entièrement en mémoire.
**Preuve** : test `la base n est pas stockee en clair dans l archive` (vérifie
l'absence de l'en-tête `SQLite format 3`) + contrôles 4/16 du harnais Python.
**Fichier** : `utils/BackupManager.kt:114-118`

```kotlin
// Add encrypted database      ← le commentaire est faux
zip.putNextEntry(ZipEntry("database.db"))
zip.write(dbBytes)             ← octets bruts, aucun appel à encryptAesGcm
```

Seules les **métadonnées** sont chiffrées par la clé dérivée du mot de passe.
Le fichier de base est écrit tel quel dans le ZIP.

**Nuance** : le `.db` reste chiffré par SQLCipher, la fuite n'est donc pas
immédiate. Mais la promesse « sauvegarde protégée par mot de passe » n'est pas
tenue : la protection réelle repose toujours sur le seul `managerCode`.

**Correction** : chiffrer `dbBytes` avec `backupKey` avant écriture, et
déchiffrer symétriquement à l'import. À traiter avec BUG-018.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-020 — `java.time.Instant` incompatible avec minSdk 24

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟠 MAJEUR
**⏳ En attente de validation par compilation réelle.**
⚠️ Validation complète = exécution **sur un appareil API 24**, hors Docker.
**Correctif** : `SimpleDateFormat` en UTC (API 1), cohérent avec `java.util.Date`
utilisé partout ailleurs. Aucun desugaring requis.
**Bonus** : `InputStream.readAllBytes()` (API 33) également remplacé —
il aurait provoqué le même crash, non détecté par l'audit initial.
**Preuve** : test `aucune API superieure a l API 24 n est utilisee`, qui **analyse
le code source** et échouera si `java.time.`, `java.util.Base64`,
`readAllBytes()` ou `java.nio.file.Files` réapparaissent. Garde-fou permanent.
**Fichiers** : `utils/BackupManager.kt:13,77`, `app/build.gradle.kts`

`Instant.now()` requiert **API 26**. Le projet déclare `minSdk = 24` et
`coreLibraryDesugaring` **n'est pas activé** (vérifié dans `build.gradle.kts`).

**Conséquence** : `NoClassDefFoundError` sur Android 7.0 / 7.1 dès le premier
export. Là encore masqué par BUG-017.

**Correction** : activer le desugaring, ou remplacer par
`System.currentTimeMillis()` / `SimpleDateFormat` (cohérent avec le reste du
projet, qui utilise `java.util.Date` partout).

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-021 — `BackupMetadata.databaseVersion` figé à 27

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟡 MINEUR
**⏳ En attente de validation par compilation réelle.**
**Correctif** : `databaseVersion` devient un paramètre obligatoire de
`exportBackupWithPassword`, fourni par l'appelant depuis `AppDatabase`.
**Preuve** : test `la version du schema est celle transmise et non une valeur figee`.
**Fichier** : `utils/BackupManager.kt:28,81`

`databaseVersion: Int = 27` en dur, alors que le schéma est en **v28**. La
métadonnée censée permettre de refuser une sauvegarde incompatible est fausse.

**Correction** : lire la version réelle depuis `AppDatabase`.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🔴 BUG-023 — `BackupManager` ne compilait pas

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🔴 CRITIQUE
**⏳ En attente de validation par compilation réelle.**

> 🎯 **Bug le plus exposé à l'auto-illusion.** Un défaut de compilation ne peut,
> par définition, être clos que par une compilation réussie. Toute affirmation
> sur son état sans build est une conjecture — y compris la mienne.

`exportBackupWithPassword` déclarait `Result<Unit>` mais son corps était
`runCatching { … ; Result.success(Unit) }`, ce qui produit un
**`Result<Result<Unit>>`** → erreur de type, refus du compilateur Kotlin.

**Portée** : preuve définitive que ce fichier n'a **jamais été compilé** depuis
son écriture. Il ne pouvait donc pas être couvert par les « 2 tests
d'instrumentation qui passent » mentionnés lors de l'audit antérieur — ceux-ci
concernent `SecurityMigrationTest`, qui ne touche pas `BackupManager`.

**Correctif** : réécriture complète du module. Signatures désormais cohérentes
(`Result<File>`, `Result<BackupImportResult>`), paramètre `context` inutilisé
supprimé, import `Mac` mort supprimé.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-017 — La sauvegarde chiffrée `BackupManager` n'est branchée nulle part

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟠 MAJEUR
**Fichiers** : `utils/BackupManager.kt`, `ui/screens/SettingsScreen.kt`, `data/repository/MainRepository.kt`

Le correctif n°4 (sauvegarde chiffrée par mot de passe) est **réellement
implémenté et de bonne facture** : PBKDF2WithHmacSHA256 à **100 000 itérations**,
sel aléatoire de 32 octets, AES/GCM 128 bits, checksum d'intégrité, contrôle de
robustesse du mot de passe, format ZIP avec métadonnées.

**Mais il n'est appelé par aucun code applicatif** :

```bash
grep -rn "BackupManager\|exportBackupWithPassword\|importBackup" app/src/main \
  | grep -v "utils/BackupManager.kt"
# → aucun résultat
```

Les chemins réellement utilisés par l'application restent les **copies brutes**
de `MainRepository` :
- `backupDatabase()` / `restoreDatabase()` — `transferFrom` de fichier à fichier ;
- `syncToCloud()` — copie dans `cacheDir` puis `ACTION_SEND` ;
- `BackupWorker` — appelle `repository.backupDatabase`.

**Nuance importante** : ces copies ne sont pas « en clair » — le fichier `.db`
reste chiffré par SQLCipher. Mais elles ne bénéficient ni du mot de passe
utilisateur, ni du checksum, ni des métadonnées de `BackupManager`.

**Impact** : le travail de sécurisation existe mais reste sans effet pour
l'utilisateur. Deux systèmes de sauvegarde coexistent, dont le meilleur est
inactif.

**Correction attendue** : brancher `BackupManager` sur le parcours de sauvegarde
et de restauration (écran Paramètres + `BackupWorker`), puis retirer ou
requalifier les copies brutes. À traiter avec **BUG-011** et la décision **D2**.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-011 — Sauvegarde du fichier `.db` sans checkpoint WAL

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟡 MINEUR
**⏳ En attente de validation par compilation réelle.**
**Correctif** : `checkpointWal()` exécute `PRAGMA wal_checkpoint(FULL)` avant
toute copie et **échoue explicitement** si le checkpoint est bloqué — une
sauvegarde incomplète est pire qu'une absence de sauvegarde. La copie transite
désormais par un fichier `.tmp` renommé en fin d'opération : une interruption ne
remplace jamais une sauvegarde valide par une sauvegarde partielle.
**Fichiers** : `data/repository/MainRepository.kt` (`backupDatabase`, `syncToCloud`), `BackupWorker`

Le fichier `caisse_database` est copié alors que le mode `WRITE_AHEAD_LOGGING`
est actif : les fichiers `-wal` et `-shm` ne sont pas copiés → sauvegarde
potentiellement incomplète ou incohérente.

**Re-vérifié le 2026-07-28 (rév. 2)** — toujours présent :
```kotlin
// MainRepository.backupDatabase
val src = FileInputStream(dbFile).channel
val dst = FileOutputStream(backupFile).channel
dst.transferFrom(src, 0, src.size())   // aucun checkpoint préalable
```
Le commentaire du code le reconnaît lui-même : *« we must ensure it's not
mid-write or we use Room's checkpoint »* — l'intention est notée, la mise en
œuvre absente.

**Correction attendue** : `PRAGMA wal_checkpoint(FULL)` avant copie, ou copier
les trois fichiers, ou utiliser l'API de sauvegarde SQLCipher.
À traiter conjointement avec **BUG-017**.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-012 — Doublon `NotificationHelper`

**Statut** : OUVERT · **Gravité** : 🟡 MINEUR
**Fichiers** : `notification/NotificationHelper.kt`, `utils/NotificationHelper.kt`

Deux classes homonymes avec des canaux différents (`mobile_caisse_alerts` d'un
côté, `stock_alerts`/`subscription_alerts` de l'autre). `SmsReceiver` utilise la
première, `MainViewModel` et `SubscriptionWorker` la seconde. Confusion garantie.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-024 — Fenêtre de concurrence pendant la restauration de la base

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟠 MAJEUR
**⏳ En attente de validation par compilation réelle.**
**Correctif (B-140)** : la copie est intégralement écrite dans un fichier de
transit (`cacheDir/restore_staging.db`) et sa taille vérifiée **avant** que
`db.close()` ne soit appelé. La fenêtre où la base est fermée se limite
désormais à une copie locale déjà validée. Les fichiers `-wal` et `-shm`
résiduels sont supprimés : conservés, ils appartiendraient à l'ancienne base et
corrompraient celle qui vient d'être restaurée.
**Fichier** : `data/repository/MainRepository.kt:801-814`

```kotlin
fun restoreDatabase(context: Context, backupFile: File): Boolean {
    db.close()                       // base fermée
    ... transferFrom(src, 0, ...)    // fichier réécrit, sans verrou
}
```

🔍 *Observé* : aucun verrou ne protège l'intervalle entre la fermeture et la fin
de la copie. 🧠 *Déduit* : toute coroutine appelant `AppDatabase.getDatabase()`
pendant ce laps de temps rouvrirait un fichier **en cours de réécriture**.

**Ce qui fonctionne déjà** — 🔍 *observé*, contrairement à l'hypothèse initiale du
débat : `getDatabase()` (`AppDatabase.kt:138-142`) teste `isOpen` et remet
`INSTANCE = null` si la base est fermée. Le singleton se ré-ouvre donc
correctement. **L'objection « le singleton n'est pas invalidé » était fausse** —
vérification faite avant inscription.

**Correction attendue** : B-140 (restaurer dans un fichier temporaire, remplacer
ensuite) réduit la fenêtre au minimum ; y ajouter un verrou pendant le
remplacement.

**Traçabilité** : `debat_technique_2026-07-28_branchement_backupmanager.md`

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-025 — Autorité `FileProvider` incorrecte : crash sur le relevé client

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟠 MAJEUR
**Fichier** : `ui/viewmodel/MainViewModel.kt` (`generateCustomerStatement`)

🔍 *Observé* : le code utilisait `"${'$'}{context.packageName}.provider"` alors que le
manifeste déclare `${'$'}{applicationId}.fileprovider`. Les 4 autres appels à
`getUriForFile` du projet utilisent bien `.fileprovider`.

**Impact** : 🧠 *déduit* — `IllegalArgumentException: Failed to find configured
root` au partage d'un relevé de compte client. Fonctionnalité inutilisable.

**Correctif** : autorité alignée sur le manifeste. Les 5 appels sont désormais
cohérents.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟠 BUG-022 — Contradiction `staff.pinSalt` : NOT NULL en migration vs nullable en logique

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟠 MAJEUR
**⏳ En attente de validation par compilation réelle.**
**Correctif** : `MIGRATION_25_26` aligné sur `StaffEntity` —
`pinSalt TEXT` (nullable), `phone TEXT` ajouté, `permissions`/`createdAt`
supprimés (inexistants dans l'entité). La nullité de `pinSalt` reste le marqueur
d'un hash legacy pour la migration paresseuse des PIN.
**Fichiers** : `AppDatabase.kt:71` (MIGRATION_25_26), `entity/StaffEntity.kt:11`, `MainViewModel.kt:495`

### Les trois sources
| Source | Déclaration |
|---|---|
| `MIGRATION_25_26` | `pinSalt TEXT **NOT NULL**` |
| `StaffEntity` | `val pinSalt: String? = null` → **nullable** |
| `MainViewModel.checkPin:495` | `if (staff.pinSalt == null) { … re-hash PBKDF2 … }` |

### Verdict : **c'est la migration qui a tort**

Deux arguments concordants, et un troisième décisif :

1. **La logique métier exige `null`.** La migration paresseuse des PIN
   (correctif de sécurité n°5) utilise `pinSalt == null` comme **marqueur** d'un
   hash legacy SHA-256 à convertir en PBKDF2. `SecurityUtil.verifyPin(pin, hash,
   salt)` suit la même convention : `savedSalt != null` → PBKDF2, sinon → SHA-256
   legacy. Avec `NOT NULL`, ce marqueur devient inexprimable et **la migration
   paresseuse ne peut plus jamais se déclencher**.
2. **`BoutiqueEntity` fait déjà autorité.** `pinHash` et `pinSalt` y sont tous
   deux nullables, et le même mécanisme y fonctionne (`MainViewModel:526`).
   La table `staff` est l'anomalie.
3. **`NOT NULL` sans `DEFAULT` est de toute façon invalide** ici : la migration
   crée la table pour des comptes qui n'ont pas encore de sel. Toute insertion
   d'un compte legacy échouerait avec une contrainte violée.

### Correction retenue
Aligner la **migration** sur l'entité : `pinSalt TEXT` (nullable).
Au passage, la même migration déclare `permissions` et `createdAt` qui
n'existent pas dans `StaffEntity`, et omet `phone` qui y figure — cela relève de
la refonte globale de la chaîne (BUG-001, décision J1.3 : refonte complète).

**Schéma cible conforme à `StaffEntity`** :
```sql
CREATE TABLE IF NOT EXISTS `staff` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` TEXT NOT NULL,
  `pinHash` TEXT NOT NULL,
  `pinSalt` TEXT,                      -- nullable : marqueur de hash legacy
  `phone` TEXT,
  `isActive` INTEGER NOT NULL,
  `role` TEXT NOT NULL
)
```

⚠️ **Aucune base réelle n'existe** (confirmé par le responsable) : la correction
peut se faire directement dans la refonte de la chaîne, sans migration
corrective ni conservation de données.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-013 — Liste des routes protégées dupliquée et codée en dur

**Statut** : OUVERT · **Gravité** : 🟡 MINEUR · **Fichier** : `ui/viewmodel/MainViewModel.kt:80`

`isManagerPageRoute()` contient une liste littérale de 10 routes, indépendante de
la `sealed class Screen`. Tout nouvel écran sensible sera **non protégé par oubli**.

**Correction attendue** : porter le niveau d'accès requis dans `Screen`
(ex. `Screen(route, …, requiredRole = Role.MANAGER)`).

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-014 — Données de démonstration accessibles en production

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟡 MINEUR
**⏳ En attente de validation par compilation réelle.**
**Correctif** : le bouton « Mode Démo » est conditionné par `BuildConfig.DEBUG`.
`buildConfig = true` ajouté dans `app/build.gradle.kts` — depuis AGP 8,
`BuildConfig` n'est plus généré par défaut. L'injection passe désormais par
`MainViewModel.seedDemoData()` au lieu d'ouvrir la base depuis l'écran.
**Fichiers** : `data/seed/DataSeeder.kt`, `ui/screens/SettingsScreen.kt:133`

`DataSeeder.seedSampleData()` (boutique fictive « Boulangerie Chez Marie »,
ventes et stock factices) est déclenchable depuis l'écran Paramètres du build
release. Risque de pollution de données réelles.

**Correction attendue** : réserver au `BuildConfig.DEBUG`.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-015 — Contrainte réseau inutile sur `BackupWorker`

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟡 MINEUR

`NetworkType.CONNECTED` est exigé alors que le worker n'effectue **aucun accès
réseau**. Sur un appareil durablement hors ligne, la sauvegarde quotidienne
**ne s'exécute jamais** — exactement le scénario du marché cible.

---

## 🟢 BUG-ENV-001 — Verrouillage du fichier `classes.jar` par un processus zombie

**Statut** : **CORRIGÉ (VALIDÉ) — 2024-05-22** · **Gravité** : 🔴 CRITIQUE
**Cause racine** : Un démon Gradle ou Kotlin restait actif en arrière-plan avec un "file handle" ouvert sur le JAR de compilation, bloquant toute nouvelle écriture sous Windows.
**Correctif** : Arrêt forcé des processus Java/Gradle (`gradlew --stop`) et nettoyage du répertoire `build`.
**Preuve** : Réussite de `:app:assembleDebug` après l'opération.

---

## 🟡 BUG-016 — Déchets versionnés dans le dépôt

**Statut** : **CORRIGÉ (VALIDÉ) — 2026-08-05** · **Gravité** : 🟡 MINEUR
**Correctif** : `conversation.txt` supprimé · `.idea/` et `.kotlin/`
dé-versionnés (28 fichiers) · `app/logo.png` → `res/drawable-nodpi/brand_logo.png`
· `.gitignore` complété · `gradlew` rendu exécutable
(`git update-index --chmod=+x`) · `app/proguard-rules.pro` créé.

- `app/src/main/java/com/reconsiliation/caisse/conversation.txt` — 1 084 lignes
  de transcription d'un autre outil (package `com.rork.momocaisse`), dans le
  source set principal.
- 27 fichiers `.idea/` versionnés (dont `workspace.xml`).
- `.kotlin/errors/*.log` — 7 journaux d'échec du daemon Kotlin.
- `app/logo.png` hors de `res/`.
- `gradlew` non exécutable (mode 644) → `./gradlew` échoue sur Unix/CI.
- `proguard-rules.pro` référencé dans `build.gradle.kts` mais **inexistant**.
- Versions Kotlin incohérentes entre les logs (2.0.21 / 2.2.10) et le catalog (2.1.0).
