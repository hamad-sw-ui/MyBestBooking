# Rapport d'analyse — Audit initial du dépôt MobileCaisse

**Date** : 2026-07-28
**Auteur** : équipe technique
**Périmètre** : dépôt complet
**Commit analysé** : `1ca7927` (Initial commit)
**Méthode** : analyse **statique uniquement** (lecture, `grep`, comparaison
schéma ⇄ entités). ⚠️ Aucune compilation : l'environnement ne dispose ni de JDK
(`java: command not found`) ni de SDK Android.

---

## 1. Question posée

Quel est l'état réel du projet, et quel écart sépare ce qu'il devrait faire de
ce qu'il fait aujourd'hui ?

## 2. Chiffres

| Indicateur | Valeur |
|---|---|
| Fichiers Kotlin | 130 |
| Lignes de Kotlin | ~11 994 |
| Entités Room | 22 |
| DAO | 20 |
| Version du schéma | 28 |
| Migrations fournies | 10 (18→28) |
| Routes de navigation | 33 |
| Écrans Compose | 30 fichiers |
| ViewModels | **1** |
| Repositories | **1** (992 lignes) |
| Tests unitaires réels | 2 |
| Tests instrumentés réels | 1 |
| Usages de `R.string` | 9 |
| Blocs `catch (e: Exception)` | 56 (dont 2 vides) |
| Commits | 1 |

### Les 5 plus gros fichiers
| Fichier | Lignes |
|---|---|
| `data/repository/MainRepository.kt` | 992 |
| `ui/screens/StockScreen.kt` | 651 |
| `ui/screens/NewSaleScreen.kt` | 647 |
| `ui/viewmodel/MainViewModel.kt` | 586 |
| `ui/screens/HomeScreen.kt` | 466 |

---

## 3. Constats

| # | Constat | Preuve | Gravité |
|---|---|---|---|
| C1 | 6 migrations produisent un schéma divergent des `@Entity` | `AppDatabase.kt` L.60-155 vs `entity/*.kt` | 🔴 |
| C2 | Aucune migration sous la v18, aucun repli | `AppDatabase.kt` `addMigrations(...)` | 🔴 |
| C3 | `androidx.appcompat` utilisé mais non déclaré | `MainActivity.kt:8`, `themes.xml:3`, absent de `build.gradle.kts` et du catalog | 🟠 |
| C4 | Dérivation de clé SQLCipher = 1 SHA-256, repli sur `ANDROID_ID` | `SecurityUtil.kt` `deriveNewKey`, `getDatabaseKeyCompat` | 🟠 |
| C5 | Secret de licence en clair + R8 désactivé + générateur admin dans l'APK | `LicenseUtil.kt:11`, `build.gradle.kts` `isMinifyEnabled = false` | 🟠 |
| C6 | `PRAGMA rekey` construit par concaténation | `AppDatabase.kt` `performRekeyIfNecessary`, `forceRekey` | 🟠 |
| C7 | `MainViewModelFactory` crée un `SavedStateHandle()` vide | `MainViewModel.kt:583` | 🟠 |
| C8 | Détection d'anomalie de date inopérante (comparaison de deux valeurs identiques) | `SmsReceiver.kt:43-46` | 🟡 |
| C9 | `CoroutineScope(Dispatchers.IO)` orphelin dans un `BroadcastReceiver` | `SmsReceiver.kt:37` | 🟡 |
| C10 | Deux classes `NotificationHelper` distinctes | `notification/` et `utils/` | 🟡 |
| C11 | Permissions demandées en bloc, résultat ignoré | `MainActivity.kt` `checkAppPermissions` | 🟡 |
| C12 | Copie du `.db` en mode WAL sans checkpoint | `MainRepository.kt` `backupDatabase`, `syncToCloud` | 🟡 |
| C13 | Liste des routes protégées codée en dur, désynchronisée de `Screen` | `MainViewModel.kt:80` | 🟡 |
| C14 | Seeder de démo accessible en release | `SettingsScreen.kt:133` | 🟡 |
| C15 | `BackupWorker` exige le réseau sans rien envoyer | `MainActivity.kt` `scheduleBackup` | 🟡 |
| C16 | Dépôt pollué : `conversation.txt` (1 084 l., package `com.rork.momocaisse`), 27 fichiers `.idea/`, `.kotlin/errors/`, `gradlew` non exécutable, `proguard-rules.pro` absent | `git ls-files`, `ls -l gradlew` | 🟡 |
| C17 | 5 accès directs à `AppDatabase` depuis `ui/` | `SplashScreen`, `ClosureScreen`, `SettingsScreen` | 🟡 |
| C18 | Room en `2.7.0-alpha12`, SQLCipher `android-database-sqlcipher` déprécié | `libs.versions.toml` | 🟠 |
| C19 | ~99 % des textes codés en dur (9 usages de `R.string` pour 40 clés) | `grep -rn "R.string"` | 🟡 |
| C20 | Couverture de tests métier nulle | `src/test`, `src/androidTest` | 🟠 |

### Détail de C1 — divergences migration ⇄ entité

| Table | Migration crée | Entité attend |
|---|---|---|
| `boutique` (20→21) | `totalQuantityOnReceipt` | `showTotalQuantityOnReceipt` |
| `processed_sms` (21→22, 26→27) | `status`, `errorMessage`, `type` | absentes |
| `categories` (22→23) | `description`, `color`, `icon` | `type` |
| `suppliers` (23→24) | `phoneNumber`, `email`, `category`, `notes` | `phone`, `address`, `totalDebt` |
| `sessions` (24→25) | `staffName`, `startCash`, `expectedEndCash`, `actualEndCash`, `status` | `sellerName`, `openingBalance`, `closingBalance`, `expectedBalance`, totaux, `isActive` |
| `staff` (25→26) | `permissions`, `createdAt` | `phone`, `pinSalt` |

**Conséquence** : installation neuve = OK (Room crée depuis les entités) ;
mise à jour d'une base existante = `IllegalStateException` au démarrage.
Le bug est **invisible en test sur émulateur neuf** — c'est ce qui le rend
particulièrement dangereux.

---

## 4. Ce qui fonctionne

Le projet n'est pas un squelette : ~85 % du métier est écrit et cohérent.

- Ventes complètes (panier, VIP, vrac/détail, remise, taxe, frais MoMo,
  paiement mixte, facture séquentielle, retours/avoirs, verrouillage).
- Stock avancé (code-barres, vrac, recettes composées, mouvements, historique de prix).
- Clients, dettes, remboursements, relances, relevés PDF.
- Fournisseurs, approvisionnements, dépenses.
- Sessions de caisse, clôture, inventaire, journal d'actions.
- Parsing SMS MoMo avec scoring, déduplication, file d'erreurs, rattrapage.
- PIN PBKDF2 avec migration paresseuse et comparaison à temps constant.
- Sauvegarde quotidienne + miroir externe, licence HMAC hors-ligne.
- Impression ESC/POS, export CSV/PDF.
- Navigation complète avec contrôle d'accès par rôle.

## 5. Ce qui manque

- Injection de dépendances (Hilt) — exigée par les règles du projet.
- Écran de gestion du personnel (entité et DAO existent, aucune UI).
- `UiState` par écran, ViewModels dédiés.
- Couche domaine / use cases.
- `proguard-rules.pro`, CI, lint configuré, ktlint/detekt.
- Schémas Room versionnés (`exportSchema = false`).
- Tests métier.
- `README.md` racine.

---

## 6. Analyse par rôle

| Rôle | Verdict | Réserve principale |
|---|---|---|
| Architecte | ⚠️ | Monolithe à 1 ViewModel / 1 Repository ; tenable aujourd'hui, bloquant demain |
| Dev Android senior | ⚠️ | Permissions mal gérées, scope orphelin, accès base depuis l'UI |
| Expert Kotlin | ⚠️ | 56 `catch (e: Exception)`, 2 vides ; statuts en chaînes libres |
| Expert Room | ❌ | **Migrations divergentes = perte de données. Bloquant.** |
| Expert Compose | ✅ | Material 3 correct, composants réutilisables ; textes en dur à corriger |
| Expert Hilt | ❌ | Absent alors que les règles l'imposent |
| Expert SQL | ⚠️ | Index manquants sur `vente_items.venteId`, `audit_items.auditId` ; `getAllVentes` non bornée |
| Ingénieur QA | ❌ | Couverture métier nulle sur une app financière |
| Expert sécurité | ❌ | Dérivation de clé faible, secrets en clair, R8 désactivé |
| Ingénieur DevOps | ❌ | Build non vérifiable, `gradlew` non exécutable, aucune CI |
| Relecteur | ⚠️ | Duplication (`NotificationHelper`), code mort, déchets versionnés |

**Deux ❌ bloquants** (Expert Room, Expert sécurité) selon la règle d'arbitrage
de `PROMPTS/roles.md`.

---

## 7. Recommandation

Traiter dans l'ordre : **build vérifiable → intégrité des données → sécurité →
tests → architecture → fonctionnalités**.

Justification : sans build reproductible, rien n'est prouvable ; sans migrations
saines, chaque livraison risque de détruire les données d'un commerçant ; sans
tests, l'engagement « aucune régression » n'est pas tenable pendant le refactor.

Plan détaillé : `.ai/ROADMAP.md` (8 jalons).

## 8. Décisions requises du responsable

- [ ] **D1** — Bases en version < 18 : écrire les migrations manquantes,
      exporter/recréer avec consentement, ou considérer le cas comme inexistant ?
- [ ] **D2** — « Synchronisation cloud » : assumer le partage manuel de fichier,
      intégrer un stockage tiers, ou construire un backend ?
- [ ] **D3** — Point de départ : jalon 0 (build) ou jalon 1.1–1.2 (schémas Room) ?
- [ ] **D4** — Disposez-vous d'un environnement avec JDK + SDK Android pour
      exécuter les builds et les tests, ou dois-je travailler en analyse statique
      et vous transmettre les commandes à exécuter ?
