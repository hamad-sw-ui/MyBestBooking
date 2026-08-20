# 📦 DÉPENDANCES

Source unique de vérité : `gradle/libs.versions.toml` (version catalog).
⚠️ Deux dépendances y échappent aujourd'hui (voir §4).

---

## 1. Outillage de build

| Élément | Version | Note |
|---|---|---|
| Gradle wrapper | **9.5.0** | Très récent ; `distributionUrl` dans `gradle/wrapper/` |
| Android Gradle Plugin | **8.13.2** | |
| Kotlin | **2.1.0** | ⚠️ Les logs `.kotlin/errors/` mentionnent 2.0.21 et 2.2.10 → incohérence |
| KSP | **2.1.0-1.0.29** | Doit rester aligné sur Kotlin |
| Compose Compiler | plugin `kotlin-compose` 2.1.0 | Intégré à Kotlin depuis 2.0 |
| kotlin-serialization | plugin 2.1.0 | |
| foojay-resolver | 1.0.0 | Résolution du toolchain JVM |
| JVM target | **11** | `sourceCompatibility`/`targetCompatibility`/`jvmTarget` |
| `org.gradle.configuration-cache` | **true** | ⚠️ Suspect avec Gradle 9.5 + KSP (voir §5) |

---

## 2. Dépendances de production

### Compose / UI
| Artefact | Version | Usage |
|---|---|---|
| `androidx.compose:compose-bom` | 2024.10.01 | Aligne toutes les versions Compose |
| `compose.ui`, `ui-graphics`, `ui-tooling-preview` | via BOM | Base UI |
| `compose.material3` | via BOM | **Design system officiel du projet** |
| `compose.material:material-icons-extended` | via BOM | ⚠️ Artefact volumineux — impact sur la taille de l'APK |
| `androidx.activity:activity-compose` | 1.9.3 | `setContent`, launchers de permission |
| `androidx.navigation:navigation-compose` | 2.8.3 | 33 routes |
| `androidx.lifecycle:lifecycle-runtime-ktx` | 2.8.7 | ⚠️ `lifecycle-viewmodel-compose` et `lifecycle-runtime-compose` non déclarés explicitement (arrivent transitivement) |

### Persistance
| Artefact | Version | Usage |
|---|---|---|
| `androidx.room:room-runtime` / `room-ktx` | **2.7.0-alpha12** | ⚠️ **Version alpha en production** |
| `androidx.room:room-compiler` (ksp) | 2.7.0-alpha12 | |
| `net.zetetic:android-database-sqlcipher` | **4.5.4** | ⚠️ Artefact **déprécié** ; le successeur est `net.zetetic:sqlcipher-android` |
| `androidx.sqlite:sqlite-ktx` | 2.4.0 | Support SQLCipher |

### Traitement en arrière-plan
| Artefact | Version | Usage |
|---|---|---|
| `androidx.work:work-runtime-ktx` | 2.9.1 | `BackupWorker`, `SubscriptionWorker` |

### Scan de code-barres
| Artefact | Version | Usage |
|---|---|---|
| `com.google.android.gms:play-services-mlkit-barcode-scanning` | 18.3.1 | ⚠️ Requiert les Google Play Services |
| `androidx.camera:camera-core/camera2/lifecycle/view` | 1.4.0 | CameraX |

### Sérialisation
| Artefact | Version | Usage |
|---|---|---|
| `org.jetbrains.kotlinx:kotlinx-serialization-json` | 1.7.3 | Uniquement `utils/BackupManager.kt` |

---

## 3. Dépendances de test

| Artefact | Version | Portée |
|---|---|---|
| `junit:junit` | 4.13.2 | `test` |
| `androidx.test.ext:junit` | 1.2.1 | `androidTest` |
| `androidx.test.espresso:espresso-core` | 3.6.1 | `androidTest` |
| `compose.ui:ui-test-junit4` | via BOM | `androidTest` |
| `compose.ui:ui-test-manifest` | via BOM | `debug` |

**Manquants pour tenir le `TEST_PLAN.md`** :
`kotlinx-coroutines-test`, `androidx.room:room-testing` (`MigrationTestHelper`),
`turbine` (test de `Flow`), `mockk`, `androidx.arch.core:core-testing`.

---

## 4. ⚠️ Dépendances hors catalog

Déclarées en dur dans `app/build.gradle.kts` alors que **les alias existent déjà**
dans `libs.versions.toml` :

```kotlin
implementation("net.zetetic:android-database-sqlcipher:4.5.4")
implementation("androidx.sqlite:sqlite-ktx:2.4.0")
```
→ Tâche **B-004**.

## ⚠️ Dépendance utilisée mais non déclarée

`androidx.appcompat` : `MainActivity : AppCompatActivity` et
`Theme.AppCompat.Light.NoActionBar` dans `themes.xml`, sans aucune déclaration.
→ **BUG-003 / B-003**.

---

## 5. Risques identifiés

| # | Risque | Gravité | Action |
|---|---|---|---|
| R1 | **Room en `alpha12`** sur une app manipulant des données financières | 🟠 | Passer en version stable (2.6.x ou 2.7.0 final) |
| R2 | **SQLCipher `android-database-sqlcipher` déprécié** ; plus de correctifs de sécurité | 🟠 | Migrer vers `net.zetetic:sqlcipher-android` (⚠️ change les imports et l'API `SupportFactory`) |
| R3 | Versions Kotlin incohérentes entre logs et catalog | 🟡 | B-005 |
| R4 | `configuration-cache` + Gradle 9.5 + KSP : 7 échecs de daemon dans `.kotlin/errors/` | 🟡 | B-006 |
| R5 | `material-icons-extended` embarque des milliers d'icônes | 🟡 | Sera atténué par R8 (B-022) |
| R6 | ML Kit lié aux Play Services | 🟡 | Limitation assumée |
| R7 | Aucune dépendance de DI alors que les règles imposent Hilt | 🟠 | B-030 |
| R8 | Aucun outil de qualité (ktlint/detekt) | 🟡 | B-097 |
| R9 | Gradle 9.5 est très en avance sur AGP 8.13 | 🟡 | Vérifier la matrice de compatibilité officielle |

---

## 6. Dépendances à ajouter (planifiées)

| Jalon | Artefact | Motif |
|---|---|---|
| J3 | `kotlinx-coroutines-test`, `room-testing`, `turbine`, `mockk` | Tests (B-090…B-094) |
| J4 | `com.google.dagger:hilt-android` + `hilt-compiler`, `androidx.hilt:hilt-work`, `hilt-navigation-compose` | Hilt (B-030) |
| J5 | `androidx.paging:paging-compose` | Pagination des ventes (B-056) |
| J7 | plugin ktlint ou detekt, JaCoCo | Qualité (B-097, B-099) |

---

## 7. Règle permanente

1. Toute nouvelle dépendance passe **par `libs.versions.toml`**, jamais en dur.
2. Justifier l'ajout ici (colonne « Usage ») avant de l'introduire.
3. Pas de dépendance en `alpha`/`beta` sur les couches critiques (données, sécurité).
4. Vérifier la licence et le poids ajouté à l'APK.
5. Mettre à jour ce fichier dans la même session que la modification du build.

*Dernière mise à jour : 2026-07-28.*
