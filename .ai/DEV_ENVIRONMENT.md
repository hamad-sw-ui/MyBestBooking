# 🐳 ENVIRONNEMENT DE DÉVELOPPEMENT ET DE TEST (DOCKER)

> **Règle permanente (Phase 6)** — Toute opération de développement, de
> compilation, d'analyse ou de test se fait dans l'environnement Docker de
> `docker/`. Cette règle prévaut sur toute autre méthode de travail.
> **Exception unique et documentée** : les tests instrumentés (§7).

Créé le 2026-07-28. Statut : **livré, non encore exécuté** (voir §10).

---

## 1. Analyse préalable : Docker apporte-t-il une valeur réelle ?

Analyse demandée avant mise en œuvre, étape par étape.

| Étape | Docker ? | Valeur réelle constatée sur ce dépôt |
|---|---|---|
| **Compilation** | ✅ **Oui, forte** | Le dépôt exige **JDK 21** (`gradle-daemon-jvm.properties : toolchainVersion=21`) alors que le code cible `jvmTarget = 11`. Les journaux `.kotlin/errors/*.log` montrent **3 versions de Kotlin différentes** (2.0.21, 2.2.10) contre 2.1.0 déclarée : preuve directe que le build a été lancé depuis des environnements divergents. Docker supprime cette classe de problème. |
| **Tests unitaires** | ✅ **Oui, forte** | Conteneur jetable = état propre garanti à chaque exécution. Élimine les faux verts dus à un cache pollué. |
| **Analyses statiques** | ✅ **Oui, forte** | ktlint/detekt ne sont **pas** dans le build (aucun plugin déclaré — B-097). Les fournir dans l'image évite d'imposer une installation locale et fige leurs versions. |
| **Génération APK/AAB** | ✅ **Oui** | Build Tools et bundletool épinglés ⇒ artefacts reproductibles. |
| **Tests instrumentés** | ❌ **Non — nuisible** | Voir §7. L'AndroidKeyStore est adossé au matériel ; `SecurityMigrationTest` valide SQLCipher + rekey. Un émulateur conteneurisé donnerait un résultat **non représentatif** : sur un test de sécurité, un faux vert est pire que pas de test. |
| **Émulateur** | ❌ **Non** | Exige `/dev/kvm` + `--privileged`, ce qui détruit la reproductibilité recherchée. La Phase 6 l'exclut d'ailleurs explicitement. |
| **Édition du code / IDE** | ❌ **Non** | Android Studio tourne sur l'hôte ; le code est monté en volume. Aucun intérêt à conteneuriser l'éditeur. |

**Conclusion** : Docker est adopté pour compilation, tests unitaires, qualité et
packaging. Il est **écarté, avec justification**, pour l'instrumentation et
l'émulateur — conformément à la latitude accordée par la Phase 6.

---

## 2. Prérequis (les seuls admis sur la machine hôte)

| Outil | Version | Obligatoire |
|---|---|---|
| Docker Engine / Desktop | ≥ 24 | ✅ |
| Docker Compose | v2 (plugin `docker compose`) | ✅ |
| `make` | quelconque | ⬜ confort |
| `adb` + appareil/émulateur | Platform Tools | ⬜ tests instrumentés uniquement |

**Aucun JDK, aucun Android SDK, aucun Gradle n'est requis sur l'hôte.**

Ressources conseillées : 4 Go de RAM et 15 Go de disque pour Docker.

---

## 3. Architecture

```
docker/
├── Dockerfile                  image de build (JDK 21 + SDK 35 + outils)
├── .dockerignore               contexte minimal (l'image ne contient pas le code)
├── docker-compose.yml          socle : service `android`, volumes de cache
├── docker-compose.dev.yml      dev : shell interactif, daemon Gradle activé
├── docker-compose.test.yml     test : `test` (validation) + `sandbox` (jetable)
└── scripts/
    ├── _common.sh              fonctions partagées (jamais lancé seul)
    ├── entrypoint.sh           contrôles au démarrage du conteneur
    ├── build-image.sh          construire / reconstruire l'image
    ├── verify-env.sh           valider l'environnement  ← AVANT toute modif
    ├── build.sh                compiler + rapports compilation & avertissements
    ├── test.sh                 tests unitaires + rapports tests & couverture
    ├── lint.sh                 Android Lint + ktlint + detekt → rapport qualité
    ├── validate.sh             CHAÎNE COMPLÈTE de validation
    ├── sandbox.sh              expérimentation isolée jetable
    ├── package.sh              APK / AAB + inspection bundletool
    ├── test-instrumented.sh    tests instrumentés (hors Docker, §7)
    ├── shell.sh                shell de développement
    └── clean.sh                nettoyage (3 niveaux)

Makefile                        raccourcis (`make help`)
```

### Choix de conception

**Le code n'est jamais copié dans l'image.** Le contexte de build est `docker/`
seul ; le dépôt est monté en volume à l'exécution. Conséquence : modifier le
code **ne nécessite jamais** de reconstruire l'image.

**Caches persistants en volumes nommés** (`mobilecaisse-gradle-cache`,
`mobilecaisse-android-cache`). Sans eux, chaque build retéléchargerait Gradle 9.5
et toutes les dépendances (~10 min contre ~30 s).

**UID/GID alignés sur l'hôte** (`USER_UID`/`USER_GID`) : les fichiers générés
dans `app/build/` appartiennent à l'utilisateur, pas à `root`.

**Gradle n'est pas installé dans l'image** : le wrapper télécharge la version
exacte exigée par le dépôt (9.5.0). Installer un Gradle système créerait
précisément la divergence que l'on cherche à éliminer.

---

## 4. Contenu de l'image

| Composant | Version | Origine |
|---|---|---|
| OpenJDK | **21** (Temurin) | imposé par `toolchainVersion=21` |
| Android SDK cmdline-tools | 13114758 | épinglé |
| Android Platform | **android-35** | `compileSdk = 35` |
| Android Build Tools | **35.0.0** | aligné sur compileSdk |
| Platform Tools (adb) | dernière | SDK |
| Gradle | **9.5.0** | via wrapper, mis en cache |
| Kotlin | **2.1.0** | via plugin Gradle du projet |
| bundletool | 1.17.2 | CLI |
| ktlint | 1.5.0 | CLI |
| detekt | 1.23.7 | CLI |
| JaCoCo (`jacococli`) | 0.8.12 | CLI |
| git, curl, unzip, zip, jq, file | — | apt |

> **Kotlin n'est pas installé en tant que binaire système.** Le compilateur
> provient du plugin Gradle Kotlin 2.1.0 du projet. Installer un `kotlinc`
> système risquerait de compiler avec une version différente de celle du build.

---

## 5. Utilisation

### Première mise en route

```bash
make image      # ou : ./docker/scripts/build-image.sh   (~5-10 min)
make verify     # valide l'environnement — OBLIGATOIRE avant toute modification
```

`make verify` échoue si un composant manque : dans ce cas, **ne pas modifier le
code** (exigence Phase 6).

### Cycle de travail quotidien

```bash
make verify        # 1. valider l'environnement
#    … modifications du code …
make validate      # 2. chaîne complète : compilation → analyses → tests
```

`make validate` s'interrompt **à la première étape en échec**, comme exigé.

### Commandes individuelles

```bash
make build            # compiler (debug)
make build-release    # compiler (release)
make test             # tests unitaires
make lint             # analyses statiques
make shell            # shell interactif
make apk              # générer un APK debug
make aab              # générer un AAB + inspection bundletool
make instrumented     # tests instrumentés (hors Docker — appareil requis)
```

### Sans `make`

```bash
./docker/scripts/verify-env.sh
./docker/scripts/validate.sh
./docker/scripts/test.sh "*SmsParser*"     # filtre de tests
```

### Reconstruire les images

```bash
make image            # avec cache (rapide)
make image-fresh      # sans cache (après modification du Dockerfile)
make clean-all && make image   # reconstruction totale
```

### Nettoyage

```bash
make clean          # conteneurs + build/, app/build/, .gradle/
make clean-caches   # + volumes de cache (prochain build long)
make clean-all      # + image Docker
```

---

## 6. Expérimentation isolée

Exigence Phase 6 : *« le projet principal ne devra jamais être utilisé comme
environnement d'expérimentation »*.

```bash
make sandbox          # conteneur temporaire → compile → teste → rapport → détruit
make sandbox-shell    # shell jetable, exploration libre
```

Garanties d'isolation :
1. le dépôt est monté **en lecture seule** (`../:/workspace:ro`) ;
2. le travail se fait dans un **tmpfs** (`/workspace-tmp`, en RAM) ;
3. le conteneur est supprimé à la sortie (`--rm`) ;
4. les artefacts hérités (`build/`, `.gradle`) sont effacés avant compilation.

Une expérimentation ne peut donc **pas** polluer le dépôt.

---

## 7. ⚠️ Exception : tests instrumentés hors Docker

### Périmètre concerné
- `androidTest/.../SecurityMigrationTest.kt` — 2 tests (rekey SQLCipher, résilience)
- `androidTest/.../ExampleInstrumentedTest.kt` — généré, à supprimer (B-096)
- Tout futur test Espresso / Compose UI

### Justification

1. **L'AndroidKeyStore est adossé au matériel.** `SecurityMigrationTest` valide
   le chiffrement SQLCipher et le mécanisme de rekey, qui reposent sur
   `SecurityUtil.saveMigratedKey`/`getMigratedKey`, eux-mêmes adossés au
   Keystore. Un émulateur conteneurisé fournit une implémentation logicielle non
   représentative. **Sur un test de sécurité, un faux vert est plus dangereux
   que l'absence de test.**
2. **L'émulateur exige `/dev/kvm` et `--privileged`**, ce qui ruine
   l'hermétisme et la portabilité recherchés.
3. **La Phase 6 le prévoit explicitement** : *« Les tests nécessitant un
   appareil Android devront être exécutés sur un appareil physique connecté ou
   sur un émulateur lancé sur la machine hôte. »*

### Workflow retenu

```bash
# 1. Compilation et tests unitaires : DANS Docker
make validate

# 2. Appareil physique branché (débogage USB) ou émulateur lancé sur l'hôte
adb devices

# 3. Tests instrumentés : sur l'hôte
make instrumented
```

`test-instrumented.sh` refuse de s'exécuter sans appareil détecté et rappelle
le motif de l'exception. Le rapport produit porte la mention **« HORS Docker »**.

### Alternative pour la CI
Un service d'appareils dans le cloud (Firebase Test Lab, BrowserStack) reste
possible ; l'APK y serait envoyé depuis Docker. Non mis en place — voir B-098.

---

## 8. Rapports produits

Tous horodatés `AAAA-MM-JJ_HHMMSS`, écrits dans `.ai/REPORTS/` :

| Fichier | Produit par | Contenu |
|---|---|---|
| `rapport_environnement_*.md` | `verify-env.sh` | validation de l'outillage |
| `rapport_compilation_*.md` | `build.sh` | résultat, durée, erreurs, artefacts |
| `rapport_avertissements_*.md` | `build.sh` | avertissements et dépréciations |
| `rapport_tests_*.md` | `test.sh` | total / réussis / échoués / ignorés |
| `rapport_couverture_*.md` | `test.sh` | couverture (voir limite ci-dessous) |
| `rapport_qualite_*.md` | `lint.sh` | ktlint + detekt + Android Lint |
| `rapport_validation_*.md` | `validate.sh` | **synthèse et verdict d'intégration** |
| `rapport_experimentation_*.md` | `sandbox.sh` | résultat du bac à sable |
| `rapport_tests_instrumentes_*.md` | `test-instrumented.sh` | ⚠️ hors Docker |

### Limite connue — couverture
`jacococli` est présent dans l'image, mais la **collecte** de couverture exige
que le build instrumente le bytecode, donc un **plugin Gradle JaCoCo** absent du
projet (vérifié : aucune occurrence dans `build.gradle.kts`). Tant que **B-099**
n'est pas fait, `rapport_couverture_*.md` reprend l'estimation de `TEST_PLAN.md`
et le signale explicitement. L'image est prête ; il manque la configuration du
build.

---

## 9. Politique de développement (contraignante)

**Avant toute modification du code**
1. construire l'image si nécessaire (`make image`) ;
2. démarrer/valider l'environnement (`make verify`) ;
3. ne modifier qu'après validation.

**Après chaque modification** → `make validate`, qui enchaîne :
compilation → analyses statiques → tests unitaires → rapports (compilation,
tests, avertissements, couverture, qualité, synthèse).

**En cas d'échec** : arrêter l'intégration, analyser, corriger, **recommencer
toute la chaîne**. Aucun code n'est « terminé » sans validation complète réussie.

**Critères de livraison** (repris dans `CHECKLISTS/avant_commit.md`) :
compilation réussie · zéro erreur bloquante · tous les tests unitaires
réussis · aucune régression · rapport de couverture · rapport de qualité.

**Tous les rôles** (Architecte, Dev Android, Kotlin, Room, Compose, Hilt, SQL,
QA, Sécurité, DevOps, Relecteur) utilisent cet environnement. Aucun
contournement n'est autorisé.

---

## 10. ⚠️ État de livraison

L'environnement est **écrit et vérifié syntaxiquement** (`bash -n` sur les
13 scripts), mais **n'a pas encore été exécuté** : l'environnement de l'agent
n'a **ni Docker, ni JDK, ni SDK Android**
(`docker: command not found`, `java: command not found`).

**Première exécution à réaliser par le responsable** (D4) :

```bash
cd MobileCaisse
make image     # ~5-10 min la première fois
make verify    # doit se terminer par « Environnement validé »
```

Puis me transmettre la sortie. Les points à confirmer en priorité :
1. téléchargement des cmdline-tools (URL épinglée `13114758`) ;
2. acceptation des licences SDK en mode non interactif ;
3. démarrage de Gradle 9.5 sous JDK 21 ;
4. compilation effective — c'est là que **BUG-003** (`androidx.appcompat` non
   déclaré) se manifestera probablement.

⚠️ **`make validate` échouera très probablement dès la compilation**, à cause de
BUG-003. C'est **attendu et utile** : ce sera la première preuve objective de ce
défaut, jusqu'ici établi par lecture seule. Sa correction est la tâche **B-003**
du jalon 0.

---

## 11. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `docker: command not found` | Docker absent | Installer Docker Desktop/Engine |
| `Cannot connect to the Docker daemon` | Démon arrêté | Démarrer Docker |
| `JDK 21 attendu, trouvé : X` | Image obsolète | `make image-fresh` |
| `/workspace ne contient pas settings.gradle.kts` | Mauvais répertoire | Lancer depuis la racine du dépôt |
| Fichiers `build/` en `root:root` | UID non aligné | `make clean && make image` |
| Build très lent | Caches purgés | Normal la première fois (~10 min) |
| `local.properties` avec `sdk.dir` de l'hôte | Chemin hôte invalide en conteneur | Avertissement seulement : `ANDROID_HOME` prévaut |
| Daemon Kotlin en échec | Mémoire contrainte | Déjà atténué : `kotlin.compiler.execution.strategy=in-process` |
| `adb devices` vide pour `make instrumented` | Aucun appareil | Brancher un téléphone ou lancer un émulateur sur l'hôte |

---

## 12. Interaction avec les défauts connus du dépôt

| Défaut | Effet sur Docker | Traitement |
|---|---|---|
| **B-001** `gradlew` non exécutable | Les scripts utilisent `sh ./gradlew` | Contourné, à corriger en J0 |
| **B-003** `appcompat` non déclaré | Fera **échouer la compilation** | Attendu — première preuve objective |
| **B-006** `configuration-cache` instable | Désactivé dans `docker-compose.test.yml` | Contourné |
| **B-097** pas de plugin ktlint/detekt | Fournis en CLI autonomes | Fonctionnel |
| **B-099** pas de JaCoCo | Couverture non mesurable | `jacococli` prêt, plugin à ajouter |
| **BUG-016** `.kotlin/errors/` versionnés | Nettoyés par `make clean` | À dé-versionner en J0 |
