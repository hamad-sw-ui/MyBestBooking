# 🏗️ ARCHITECTURE

> Ce document décrit l'architecture **réellement constatée dans le code**
> au 2026-07-28, pas une architecture idéale. Les écarts avec la cible sont
> signalés par ⚠️ et tracés dans `BACKLOG.md`.

---

## 1. Modules

**Mono-module.** `settings.gradle.kts` déclare `rootProject.name = "CAISSE"` et
un seul include : `:app`.

```
CAISSE/
├── build.gradle.kts          # plugins déclarés apply false
├── settings.gradle.kts       # pluginManagement + repositories centralisés
├── gradle/libs.versions.toml # version catalog (source unique des versions)
├── gradlew / gradlew.bat     # ⚠️ gradlew non exécutable (mode 644)
└── app/                      # unique module applicatif
```

⚠️ Pas de module `:core`, `:data`, `:domain`. Acceptable à cette taille, mais
le découpage en packages doit rester strict pour préserver l'option.

---

## 2. Packages (`app/src/main/java/com/reconsiliation/caisse/`)

```
caisse/
├── CaisseApplication.kt        Application ; installe un UncaughtExceptionHandler
├── MainActivity.kt             AppCompatActivity ; permissions + WorkManager + setContent
├── conversation.txt            ⚠️ DÉCHET : 1084 l. de transcript d'un autre outil
│
├── data/
│   ├── local/
│   │   ├── AppDatabase.kt      Room + SQLCipher, singleton, 10 migrations, rekey
│   │   ├── Converters.kt       TypeConverter Date <-> Long
│   │   ├── BackupWorker.kt     CoroutineWorker : sauvegarde quotidienne
│   │   ├── SubscriptionWorker.kt CoroutineWorker : alerte expiration abonnement
│   │   ├── dao/                20 interfaces @Dao
│   │   └── entity/             22 data class @Entity
│   ├── prefs/PreferencesManager.kt  SharedPreferences (setup, sync SMS, verrouillage)
│   ├── repository/MainRepository.kt ⚠️ 992 lignes — objet-dieu
│   └── seed/DataSeeder.kt      Données de démo ⚠️ accessible depuis l'UI Paramètres
│
├── notification/NotificationHelper.kt  ⚠️ DOUBLON avec utils/NotificationHelper.kt
│
├── printing/EscPosPrinter.kt   Impression ESC/POS via BluetoothSocket
│
├── sms/
│   ├── SmsParser.kt            Parsing par scoring des SMS MoMo (objet pur, testable)
│   ├── SmsReceiver.kt          BroadcastReceiver SMS_RECEIVED + BOOT_COMPLETED
│   └── SmsSyncManager.kt       Rattrapage des SMS manqués depuis le ContentProvider
│
├── ui/
│   ├── navigation/AppNavigation.kt  sealed class Screen + NavHost (33 routes) + dialog PIN
│   ├── components/             BigButton, CaisseDialogs, CaisseTextFields, NumericKeypad
│   ├── scanner/BarcodeScanner.kt    CameraX + ML Kit
│   ├── screens/                30 fichiers d'écrans Compose
│   ├── theme/                  Color.kt, Theme.kt (Material 3), Type.kt
│   └── viewmodel/MainViewModel.kt   ⚠️ 586 lignes — ViewModel unique global
│
└── utils/
    ├── AnomalyEngine.kt        Détection de fraude (3 règles)
    ├── BackupManager.kt        Export/import JSON via kotlinx.serialization
    ├── ExportUtil.kt           Export CSV + partage
    ├── FeeCalculator.kt        Frais MoMo MTN/Orange
    ├── FormatUtil.kt           Formatage montants et dates
    ├── HapticHelper.kt         Vibration
    ├── LicenseUtil.kt          Licence HMAC-SHA256 hors-ligne
    ├── NotificationHelper.kt   ⚠️ DOUBLON
    ├── PhoneUtil.kt            Normalisation des numéros camerounais
    └── SecurityUtil.kt         Keystore, PBKDF2, dérivation clé SQLCipher
```

---

## 3. Couches et flux de données

```
┌──────────────────────────────────────────────────────────────┐
│ UI (Jetpack Compose)                                          │
│  30 écrans · Material 3 · chacun appelle viewModel()          │
│  ⚠️ 5 écrans accèdent directement à AppDatabase / filesystem  │
└───────────────┬──────────────────────────────────────────────┘
                │ StateFlow / collectAsState  ▲  appels de fonctions
                ▼                             │
┌──────────────────────────────────────────────────────────────┐
│ MainViewModel (AndroidViewModel + SavedStateHandle)           │
│  · rôle utilisateur, dialog PIN, contrôle d'accès par route   │
│  · panier (CartItem), statistiques, erreurs UI (_uiError)     │
│  · ~90 fonctions déléguant à MainRepository                   │
│  ⚠️ ViewModel unique partagé par TOUS les écrans              │
└───────────────┬──────────────────────────────────────────────┘
                │ suspend / Flow
                ▼
┌──────────────────────────────────────────────────────────────┐
│ MainRepository (992 l.)                                       │
│  · orchestre 20 DAO, transactions Room (withTransaction)      │
│  ⚠️ contient aussi : fichiers, PDF, Intents, Bluetooth, SMS   │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│ AppDatabase (Room v28) — chiffrée SQLCipher                   │
│  22 entités · 20 DAO · 10 migrations (18→28)                  │
└──────────────────────────────────────────────────────────────┘
```

### Entrées hors-UI (contournent le ViewModel)

```
SmsReceiver ──► SmsParser ──► MainRepository (instance ad hoc) ──► AppDatabase
BackupWorker ─────────────► MainRepository (instance ad hoc) ──► AppDatabase
SubscriptionWorker ───────► MainRepository (instance ad hoc) ──► AppDatabase
```
⚠️ Trois instances distinctes de `MainRepository` coexistent avec celle du
ViewModel. Pas de source unique → risque d'incohérence et de double travail.

---

## 4. ViewModel

- **Une seule classe** : `MainViewModel(application, savedStateHandle) : AndroidViewModel`.
- Instanciée dans `AppNavigation` via `MainViewModelFactory`, puis récupérée
  par `viewModel()` dans chaque écran (même `ViewModelStoreOwner` → instance partagée).
- État exposé en `StateFlow` : `boutique`, `currency`, `allVentes`, `allStock`,
  `cart`, `uiError`, `showPinDialog`, `userRole`, `staffId`…
- Session utilisateur stockée dans `SavedStateHandle` (`user_role`, `staff_id`).
- ⚠️ **BUG-007** : `MainViewModelFactory` crée un `SavedStateHandle()` **vide**
  → la restauration après process death ne fonctionne pas réellement.
- ⚠️ Pas de `UiState` par écran ; les écrans consomment des flux globaux.

### Contrôle d'accès

`requestAccess(route)` + `isManagerPageRoute(route)` : liste **codée en dur** de
10 routes réservées au rôle `MANAGER`. Si le rôle est insuffisant, un dialog PIN
global (rendu dans `AppNavigation`) s'affiche ; `handlePinInput` valide via
`checkPin` (Staff → Manager boutique → Staff boutique legacy).
⚠️ La liste de routes protégées est dupliquée de la déclaration `Screen` :
risque d'oubli lors de l'ajout d'un écran.

---

## 5. Repository

`MainRepository(db: AppDatabase, context: Context)` — 78 fonctions.

Responsabilités actuellement mélangées :

| Responsabilité | Devrait être |
|---|---|
| Accès DAO, transactions Room | ✅ repository |
| Logique métier ventes / stock / dettes | → `domain/usecase` |
| Génération PDF (relevés, tickets) | → `report/` |
| Intents Android (partage, SMS, USSD) | → `platform/` |
| Impression Bluetooth | → `printing/` (déjà existant, à utiliser via interface) |
| Sauvegarde / restauration fichiers `.db` | → `backup/` |
| Vérification abonnement / licence | → `licensing/` |

Points notables :
- Flux exposés directement depuis les DAO (`val allVentes: Flow<...> = db.venteDao()...`).
- `withTransaction` utilisé correctement pour les opérations composées
  (vente + items + stock + recette + dette + log).
- `logAction(...)` centralise l'écriture du journal d'actions.

---

## 6. DAO / Room

- 20 DAO, un par agrégat. Retours `Flow<List<T>>` pour la lecture réactive,
  `suspend` pour l'écriture.
- Relations : `VenteWithItems`, `AuditWithItems` (`@Transaction` + `@Relation`).
- `@TypeConverters(Converters::class)` pour `Date`.
- Détails complets : voir **`DATABASE.md`**.

---

## 7. Navigation

- `sealed class Screen(route, title?, icon?)` avec `data object` par destination.
- `NavHost` unique, `startDestination = "splash"`.
- Arguments typés : `stock?barcode={barcode}` (String nullable),
  `stock_movements/{productId}`, `price_history/{productId}`,
  `customer_profile/{customerId}`, `sale_detail/{venteId}` (Long).
- Barre de navigation basse : Accueil, Ventes, Stock, Rapports, Paramètres
  (les écrans dotés d'un `title` + `icon`).
- Flux de démarrage : `Splash` → (`Onboarding` | `Setup`) → `Pin` → `Home`.
- Le dialog PIN est rendu **au-dessus du NavHost**, dans le même `Scaffold`.

---

## 8. Injection de dépendances

⚠️ **Aucune.** Pas de Hilt, pas de Koin, pas de Dagger dans `libs.versions.toml`.

Mécanismes de substitution en place :
- `AppDatabase.getDatabase(context)` — singleton `@Volatile` + `synchronized`,
  avec ré-ouverture si l'instance a été fermée.
- `MainViewModelFactory` — fabrique manuelle.
- `MainRepository` — instancié à la demande (4 endroits distincts).

**Cible** (planifiée, non implémentée) : Hilt avec
`@HiltAndroidApp`, `@AndroidEntryPoint`, `@HiltViewModel`,
`@HiltWorker` + `HiltWorkerFactory`, module `DatabaseModule` fournissant
`AppDatabase` et les DAO en `@Singleton`, et `EntryPointAccessors` pour
`SmsReceiver`.

---

## 9. Synchronisation

Il n'y a **pas de synchronisation serveur**. Ce qui porte ce nom dans le code :

| Mécanisme | Réalité |
|---|---|
| `syncToCloud(context)` | Copie le `.db` dans le cache et lance un `Intent.ACTION_SEND` (Gmail/Drive/WhatsApp au choix de l'utilisateur) |
| `BackupWorker` | Toutes les 24 h : `filesDir/daily_backup.db` + miroir `getExternalFilesDir()/caisse_mirror.db`, contrainte réseau `CONNECTED` (⚠️ inutile puisque aucun upload) |
| `SmsSyncManager.catchUp()` | Relit le ContentProvider SMS depuis `last_sms_sync` pour rattraper les SMS reçus app fermée |
| `SubscriptionWorker` | Toutes les 24 h : notifications J-7 / J-3 / J-1 / J-0 |
| Réconciliation | `SmsReceiver` rapproche un SMS d'une vente `PENDING` ; sinon crée une vente « orphan » ou une entrée `sms_errors` |

---

## 10. Thème et design system

- `Theme.kt` : Material 3, `lightColorScheme` / `darkColorScheme`, palette dans `Color.kt`.
- `Type.kt` : typographie Material 3.
- ⚠️ `res/values/themes.xml` hérite encore de `Theme.AppCompat.Light.NoActionBar`
  et `MainActivity` étend `AppCompatActivity`, alors que `androidx.appcompat`
  **n'est pas déclaré** dans le build (BUG-003).
- Composants maison : `BigButton`, `NumericKeypad`, `CaisseDialogs`, `CaisseTextFields`.

---

## 11. Écarts avec l'architecture cible

| # | Écart constaté | Cible | Tâche |
|---|---|---|---|
| A1 | Pas de DI | Hilt | BACKLOG P2 |
| A2 | Repository objet-dieu (992 l.) | Repositories par domaine + use cases | BACKLOG P3 |
| A3 | ViewModel unique (586 l.) | 1 ViewModel par écran + `UiState` | BACKLOG P3 |
| A4 | Accès DB depuis l'UI (5 endroits) | Passer par ViewModel | BACKLOG P2 |
| A5 | `CoroutineScope(Dispatchers.IO)` non annulable dans `SmsReceiver` | `goAsync` + scope maîtrisé / WorkManager | BACKLOG P2 |
| A6 | Doublon `NotificationHelper` | Une seule classe | BACKLOG P1 |
| A7 | Texte codé en dur (9 usages de `R.string` sur ~40 clés) | `strings.xml` systématique | BACKLOG P4 |
| A8 | `exportSchema = false` | `true` + schémas versionnés en Git | BACKLOG P1 |
