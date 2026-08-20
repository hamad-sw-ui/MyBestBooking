# 📋 BACKLOG

Légende : `□` tâche non terminée · `☑` tâche terminée

Le backlog est déduit de l'**écart entre ce que le projet devrait faire et ce
qu'il fait réellement** (audit du 2026-07-28). L'ordre d'exécution est défini
par `ROADMAP.md`.

Identifiants stables : `B-xxx` (ne jamais renuméroter).

> **Rév. 2 — 2026-07-28** : intégration des décisions D1–D4 du responsable et
> révision après vérification des correctifs de sécurité antérieurs
> (voir `BUGS.md` § Note de révision).
> Contexte clé : **aucun utilisateur en production** → les priorités sont
> réordonnées en faveur d'un socle propre plutôt que d'un sauvetage de données.

---

## P0 — Sauver le build et les données (bloquant)

- ☑ **B-001** `gradlew` rendu exécutable
- ☑ **B-002** `app/proguard-rules.pro` créé (Room, SQLCipher, serialization, ML Kit)
- ☑ **B-003** Migré vers `ComponentActivity` + thème plateforme — **zéro dépendance ajoutée** *(BUG-003)*
- ☑ **B-004** `sqlcipher` et `sqlite-ktx` déplacés dans le version catalog
- ☑ **B-005** Kotlin figé à 2.1.0 par le catalog ; `.kotlin/errors/` dé-versionné
- ☑ **B-006** `configuration-cache=false` + `kotlin.compiler.execution.strategy=in-process`
- ☑ **B-007** `conversation.txt` supprimé (1 084 lignes)
- ☑ **B-008** Dépôt nettoyé : 28 fichiers dé-versionnés, logo déplacé dans `res/`
- □ **B-009** Activer `exportSchema = true` et versionner `app/schemas/` en Git
- □ **B-010** 🔴 Réécrire les 6 migrations divergentes + migration corrective 28→29 *(BUG-001)*
- □ **B-011** 🔴 Bases < v18 : détection + écran de consentement + export de courtoisie + recréation *(BUG-002 — **décision D1 : perte assumée avec accord de l'utilisateur**)*
- □ **B-012** Écrire les tests `MigrationTestHelper` pour toute la chaîne 18→29
- ☑ **B-013** Checkpoint WAL + copie via fichier temporaire *(BUG-011)*
- ☑ **B-120** Corriger le chiffrement AES-GCM *(BUG-018)* — tag géré par `doFinal`, format v2
- ☑ **B-121** Chiffrer réellement la base dans l'archive *(BUG-019)* — chiffrement en flux
- ☑ **B-122** Remplacer `java.time.Instant` et `readAllBytes()` *(BUG-020)* — API 24 garantie par test
- ☑ **B-123** `databaseVersion` fourni par l'appelant *(BUG-021)*
- ☑ **B-124** 26 tests unitaires `BackupManager` + harnais Python indépendant (16/16)
- ☑ **B-101** `BackupManager` branché sur A, B, C *(BUG-017)*
- ☑ **B-140** Restauration via fichier de transit validé avant `db.close()` *(BUG-024, risque R2)*
- ☑ **B-141** `BackupFormat.detect()` — détection par signature binaire + 9 tests *(risque R1)*
- ☑ **B-142** `BackupPasswordDialog` partagé par les 3 écrans
- ☑ **B-143** Avertissement non contournable dans le dialogue d'export
- □ **B-144** Documenter dans l'UI la coexistence des deux formats de sauvegarde
- ☑ **B-156** Fenêtre de concurrence réduite au minimum *(BUG-024)*

### Issus du débat technique (2026-07-28)
- □ **B-145** Extraire un `BackupRepository` — *avis Architecte, reporté à J5*
- □ **B-146** Mesurer la durée d'export sur une base de 50 Mo avant d'optimiser
- ☑ **B-157** `CHECKLISTS/verification_sauvegarde.md` — protocole avant/après, 6 chemins *(exigence QA levée)*
- ☑ **B-158** L'ancien export non protégé n'est plus atteignable depuis l'UI

### Opportunités identifiées (rapport `opportunites_2026-07-28_sauvegarde.md`) — **non planifiées**
- □ **B-155** 🔴 Double saisie du mot de passe à l'export *(supprime le mode d'échec le plus probable)*
- ☑ **B-147** `shareBackupFile()` centralise le partage *(partiel : CSV/PDF restent)*
- □ **B-148** Fusionner les deux implémentations d'export CSV
- □ **B-149** Extraire les utilitaires Base64 dans `utils/Base64Compat.kt`
- □ **B-150** Restauration en flux plutôt qu'en mémoire *(pic mémoire ÷ 2)*
- □ **B-151** `BackupWorker` : éviter les sauvegardes identiques
- □ **B-152** Journaliser export et restauration dans `action_logs`
- □ **B-153** Purger les fichiers de cache après partage
- □ **B-154** Afficher la date de la dernière sauvegarde
- ☑ **B-138** Corriger l'erreur de compilation de `BackupManager` *(BUG-023, découvert en réparant)*
- ☑ **B-125** `MIGRATION_25_26` aligné sur `StaffEntity` : `pinSalt` nullable, `phone` ajouté *(BUG-022)*
- □ **B-014** Retirer la contrainte `NetworkType.CONNECTED` de `BackupWorker` *(BUG-015)*

## P1 — Sécurité

- ☑ **B-020** ~~Renforcer la dérivation de clé SQLCipher~~ — **déjà traité** (correctif n°3 : dérivation `phone`+`managerCode`, AndroidKeyStore, rekey auto/manuel, mode standard SQLCipher). Reste optionnel : ajouter un sel aléatoire *(BUG-004 requalifié 🟡, non prioritaire)*
- ☑ **B-021** ~~Migration des bases existantes vers la nouvelle dérivation~~ — **déjà implémentée** (`performRekeyIfNecessary` + `forceRekey`, couvertes par `SecurityMigrationTest`)
- □ **B-022** Activer R8 en release (`isMinifyEnabled`, `isShrinkResources`) + règles keep (Room, SQLCipher, serialization, ML Kit)
- □ **B-023** Retirer `LicenseUtil.generateActivationKey` de l'APK client *(BUG-005)*
- □ **B-024** Sortir `SECRET_SALT` du code source clair *(BUG-005)*
- □ **B-025** Sécuriser et centraliser `PRAGMA rekey` (validation stricte de l'entrée) *(BUG-006)*
- □ **B-026** Réserver `DataSeeder.seedSampleData()` à `BuildConfig.DEBUG` *(BUG-014)*
- □ **B-027** Porter le rôle requis dans `Screen` au lieu de la liste codée en dur *(BUG-013)*
- □ **B-028** Augmenter `PBKDF2_ITERATIONS` pour les PIN (5 000 → ≥ 100 000) — le mécanisme de re-hash paresseux existe déjà ✅, il suffit de relever la constante *(incohérence : `BackupManager` utilise déjà 100 000)*
- □ **B-029** Corriger la détection d'anomalie de date SMS *(BUG-008)*

## P2 — Architecture : Hilt & assainissement

- □ **B-030** Introduire Hilt (plugin, dépendances, `@HiltAndroidApp`, `@AndroidEntryPoint`)
- □ **B-031** `DatabaseModule` : `AppDatabase` + 20 DAO en `@Singleton`
- □ **B-032** `RepositoryModule` + `@ApplicationContext` contraint
- □ **B-033** `@HiltViewModel` sur `MainViewModel` ; supprimer `MainViewModelFactory` *(BUG-007)*
- □ **B-034** `@HiltWorker` + `HiltWorkerFactory` pour `BackupWorker` et `SubscriptionWorker`
- □ **B-035** `EntryPointAccessors` pour `SmsReceiver` (fin des instanciations ad hoc de repository)
- □ **B-036** Fusionner les deux `NotificationHelper` en une seule classe injectée *(BUG-012)*
- □ **B-037** Supprimer les 5 accès directs à `AppDatabase` depuis `ui/`
- □ **B-038** Corriger le scope de coroutine de `SmsReceiver` *(BUG-009)*
- □ **B-039** Déplacer permissions et planification WorkManager hors de `MainActivity`
- □ **B-040** Supprimer le code mort : `PlaceholderScreens.kt`, `StaffDao.getStaffByPin`, `FeeCalculator.calculateMomoFees`, `DataSeeder.seedIfNeeded`
- □ **B-041** Auditer l'usage réel de `BigButton`, `CaisseDialogs`, `CaisseTextFields`, `BackupManager`

## P3 — Architecture : découpage

- □ **B-050** Découper `MainRepository` (992 l.) : `SalesRepository`, `StockRepository`, `CustomerRepository`, `SupplierRepository`, `CashRepository`, `SettingsRepository`
- □ **B-051** Extraire la génération PDF/ticket hors du repository
- □ **B-052** Extraire les `Intent` Android (partage, SMS, USSD) dans une couche `platform/`
- □ **B-053** Introduire un `UiState` par écran (commencer par `NewSaleScreen`)
- □ **B-054** Découper `MainViewModel` (586 l.) en ViewModels par écran
- □ **B-055** Remplacer les statuts en chaînes (`"CONFIRMED"`, `"MANAGER"`…) par des `enum class`
- □ **B-056** Paginer `allVentes` (Paging 3 ou requêtes bornées)
- □ **B-057** Ajouter les index manquants : `vente_items.venteId`, `audit_items.auditId`
- □ **B-058** Transformer `audit_items.auditId` en véritable `ForeignKey`
- □ **B-059** Centraliser la gestion d'erreur (type `AppError` scellé au lieu de `String`)

## P4 — Fonctionnalités manquantes / incomplètes

### Décision D2 — sauvegarde distante (deux volets en parallèle)
- ☑ **B-110** « Exporter et partager » — libellés UI, chooser, `logAction`, nom de fichier. Noms de fonctions **non modifiés** (consigne)
- □ **B-111** Volet 2a : rapport d'analyse comparatif Google Drive vs Dropbox (`REPORTS/`)
- □ **B-112** Volet 2b : implémenter la sauvegarde automatique distante retenue (dépend de B-101 : on n'envoie que des archives `BackupManager`)

- ☑ **B-070** Écran de gestion du personnel — CRUD, rôles, désactivation sans perte d'historique
- □ **B-071** Compléter le pilotage des sessions de caisse (ouverture/fermeture guidée + rapprochement)
- □ **B-072** Enrichir `AnomalyEngine` et exposer les alertes dans l'UI
- □ **B-073** Externaliser tous les textes vers `strings.xml` (aujourd'hui 9 usages de `R.string`)
- □ **B-074** Ajouter la traduction `values-en/`
- ☑ **B-075** ~~Décider du sort de la « sync cloud »~~ — **tranché (D2)** : renommage honnête *et* vrai service distant en parallèle → voir B-110, B-111, B-112
- □ **B-076** Remplacer `Toast`/messages bruts par des `Snackbar` Material 3 cohérents
- □ **B-077** Étudier le passage des montants de `Double` vers un type exact (centimes en `Long`)
- □ **B-078** Refondre le parcours de permissions (contextuel + gestion du refus) *(BUG-010)*

## P7 — Software Factory *(construite au fil des besoins réels)*

- ☑ **SF-01** `preflight` — analyse statique pré-compilation, 8 contrôles, rapport §19.6
- ☑ **SF-02** `orchestrator` + `analyzers` — cycle complet, causes racines, 10 tests
- ☑ **SF-03** `autofix` — 141 corrections appliquées, zones protégées respectées
- ☑ **SF-06** Canal de retour `last-cycle/` — supprime le copier-coller de journal
- ☑ **SF-04** `environment` (détection + émulateur) + pipeline unifié en 8 étapes
- ☑ **SF-05** Execution Engine — point d'entrée unique, reprise, boucle auto
- ☑ **SF-06** `./software-factory/run` — point d'entrée unique + promotion automatique des statuts
- ☑ **SF-08** `environment/provision.py` — SDK, AVD, licences, Docker, adb automatisés (6 tests)
- □ **SF-07** CI GitHub Actions *(quand le build est stable)*

## P6 — Environnement Docker *(livré 2026-07-28, à valider)*

- ☑ **B-130** Créer `docker/` : Dockerfile (JDK 21 + SDK 35 + build-tools 35), 3 compose, 13 scripts
- ☑ **B-131** Documenter dans `.ai/DEV_ENVIRONMENT.md` (analyse de valeur, usage, exceptions)
- ☑ **B-132** Intégrer Docker aux checklists et règles `.ai/`
- □ **B-133** 🔴 **Première exécution par le responsable** : `make image && make verify` *(bloquant — l'agent n'a pas Docker)*
- □ **B-134** Exécuter `make validate` et archiver les rapports dans `.ai/REPORTS/`
- □ **B-135** Ajouter les plugins Gradle ktlint/detekt pour que les analyses bloquent la chaîne *(lié à B-097)*
- □ **B-136** Ajouter le plugin JaCoCo pour rendre la couverture réellement mesurable *(lié à B-099)*
- □ **B-137** Réutiliser l'image Docker dans la CI GitHub Actions *(lié à B-098)*

## P5 — Qualité, tests, CI

- □ **B-090** Tests unitaires `SmsParser` (jeu de SMS MTN/Orange réels + pièges)
- □ **B-091** Tests unitaires `FeeCalculator` (barèmes MTN/Orange)
- □ **B-092** Tests unitaires `LicenseUtil` (clé valide, expirée, falsifiée)
- □ **B-093** Tests unitaires `AnomalyEngine`
- □ **B-094** Tests de repository avec base Room en mémoire (vente + stock + recette + dette)
- □ **B-095** Tests instrumentés Compose sur les parcours critiques (nouvelle vente, clôture)
- □ **B-096** Supprimer les tests générés vides (`ExampleUnitTest`, `ExampleInstrumentedTest`)
- □ **B-097** Ajouter ktlint ou detekt + configuration
- □ **B-098** CI GitHub Actions : `assembleDebug`, `test`, `lint` sur chaque PR
- □ **B-099** Mesurer la couverture (JaCoCo) et publier dans `REPORTS/`
- ☑ **B-100** `README.md` racine rédigé

---

## Vue d'ensemble

| Priorité | Total | Terminées |
|---|---|---|
| P0 — Build & données | 28 | 17 |
| P1 — Sécurité | 10 | 2 |
| P2 — Hilt & assainissement | 12 | 0 |
| P3 — Découpage | 10 | 0 |
| P4 — Fonctionnalités | 12 | 1 |
| P5 — Qualité & CI | 11 | 1 |
| P6 — Environnement Docker | 8 | 3 |
| **TOTAL** | **114** | **48** |

> 14 tâches ajoutées par la Phase 7 (débat + opportunités) : autant de défauts
> ou d'améliorations identifiés **avant** d'écrire une ligne de code.

*Dernière mise à jour : 2026-07-28 (rév. 4 — Phase 6 : environnement Docker)*
