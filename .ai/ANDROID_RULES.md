# 🤖 RÈGLES ANDROID SPÉCIFIQUES

Complément de `CODING_RULES.md`, ciblé plateforme.

---

## 1. Cycle de vie & Compose

- `collectAsStateWithLifecycle()` plutôt que `collectAsState()` pour tout flux
  alimenté par la base (évite de collecter en arrière-plan).
- `remember` / `rememberSaveable` : `rememberSaveable` dès que la valeur doit
  survivre à une rotation ou à la mort du processus.
- ❌ Pas d'appel suspendu direct dans le corps d'un Composable :
  `LaunchedEffect(key)`, `rememberCoroutineScope()` pour les événements.
- ❌ Pas de logique dans `LaunchedEffect(Unit)` qui écrit en base
  (violation existante : `SplashScreen` lit la base directement).
- Passer des **lambdas d'événement**, pas le ViewModel entier, aux composants
  réutilisables (testabilité + preview).
- `Modifier` toujours en premier paramètre optionnel des composants publics.

## 2. Performance Compose (appareils minSdk 24, RAM limitée)

- Listes → `LazyColumn` / `LazyRow` avec `key = { it.id }` **obligatoire**.
- Pas de `Modifier.verticalScroll` sur une liste potentiellement longue.
- Éviter les lambdas capturant l'état instable ; préférer les paramètres stables.
- Les données volumineuses (historique des ventes) doivent être **paginées ou
  filtrées côté SQL**, jamais chargées entièrement en mémoire.
  ⚠️ `allVentes: Flow<List<VenteEntity>>` viole ce point aujourd'hui.
- Pas de calcul lourd dans la composition : le faire dans le ViewModel.

## 3. Room / SQLCipher

- `SQLiteDatabase.loadLibs(context)` **avant** toute ouverture (déjà fait dans
  `AppDatabase.getDatabase`).
- L'instance de base est **unique** pour tout le processus. Ne jamais en
  construire une seconde.
- Toute écriture est `suspend` et hors du main thread.
- `allowMainThreadQueries()` : **interdit**, en toutes circonstances.
- `fallbackToDestructiveMigration()` : **interdit en release** (perte de données
  financières). Uniquement envisageable pour les versions < 18 avec sauvegarde
  préalable explicite et consentement de l'utilisateur.
- Toute nouvelle colonne doit avoir une valeur par défaut compatible SQL.

## 4. Permissions

- Demander **au moment de l'usage**, pas en bloc au démarrage.
  ⚠️ `MainActivity.checkAppPermissions()` demande tout d'un coup et **ignore
  `onRequestPermissionsResult`** → à refondre.
- Préférer `rememberLauncherForActivityResult(RequestPermission())`.
- Toujours gérer le refus : l'app doit rester utilisable
  (SMS refusé → saisie manuelle ; caméra refusée → saisie du code-barres).
- Justifier `READ_SMS`/`RECEIVE_SMS` dans la fiche Play Store (permission
  sensible ; déclaration d'usage obligatoire).
- API 31+ : `BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN`. API 33+ : `POST_NOTIFICATIONS`.

## 5. WorkManager

- Workers `CoroutineWorker`, idempotents et re-exécutables sans effet de bord.
- `Result.retry()` pour l'échec transitoire, `Result.failure()` pour le définitif.
- Ne poser une contrainte réseau que si le travail utilise le réseau.
  ⚠️ `BackupWorker` impose `NetworkType.CONNECTED` sans rien envoyer → à retirer.
- Nom unique + `ExistingPeriodicWorkPolicy` explicite (déjà en place).

## 6. BroadcastReceiver

- `goAsync()` + travail borné (< 10 s), ou délégation à `WorkManager`.
- ❌ Pas de `CoroutineScope(Dispatchers.IO)` orphelin : le `PendingResult` doit
  être `finish()` dans tous les chemins, y compris en cas d'exception.
- Les receivers exportés doivent être protégés par permission
  (✅ `BROADCAST_SMS` déjà en place).

## 7. Contexte & fuites mémoire

- Stocker uniquement `applicationContext` dans un singleton ou un repository.
  ⚠️ `MainRepository(db, context)` reçoit parfois un `Context` d'Activity → à
  contraindre via `@ApplicationContext` lors du passage à Hilt.
- Aucune référence à une Activity, une Vue ou un `NavController` dans un ViewModel.
- Fermer systématiquement `Cursor`, `BluetoothSocket`, flux fichiers
  (`use { }` de préférence).

## 8. Ressources

- Tout texte visible → `res/values/strings.xml` avec identifiant préfixé
  (`title_`, `action_`, `error_`, `label_`).
- Pluriels → `<plurals>`. Formats → placeholders positionnels `%1$s`.
- Dimensions récurrentes → `dimens.xml`. Couleurs → `ui/theme/Color.kt`.
- Prévoir `values-en/` (le marché est bilingue FR/EN au Cameroun).

## 9. Build & release

- Les versions vivent **exclusivement** dans `gradle/libs.versions.toml`.
  ❌ Pas de `implementation("group:artifact:x.y.z")` en dur dans
  `app/build.gradle.kts` (2 violations : sqlcipher, sqlite-ktx — alors que les
  alias existent déjà dans le catalog).
- Toute dépendance utilisée doit être **déclarée explicitement** (jamais via
  transitive). ⚠️ `androidx.appcompat` manquant (BUG-003).
- Release : `isMinifyEnabled = true`, `isShrinkResources = true`, règles R8
  dans `app/src/main/keepRules/` (Room, SQLCipher, kotlinx-serialization, ML Kit).
- `proguard-rules.pro` référencé dans `build.gradle.kts` **doit exister**.
- `gradlew` doit être exécutable (`git update-index --chmod=+x gradlew`).

## 9bis. Environnement Docker obligatoire  *(Phase 6)*

- **Toute** compilation, analyse ou exécution de tests unitaires se fait dans
  `docker/` — voir `.ai/DEV_ENVIRONMENT.md`.
- Ne jamais lancer `./gradlew` directement sur l'hôte pour valider une
  modification : le résultat ne serait pas reproductible.
- Utiliser `sh ./gradlew` (le wrapper n'est pas exécutable — B-001).
- Expérimentations : `make sandbox` uniquement, jamais dans le dépôt principal.
- Exception : tests instrumentés sur appareil réel (`make instrumented`).

## 10. Qualité & outillage

- `./gradlew lint` sans erreur bloquante avant toute PR.
- Cible : ajouter **ktlint** ou **detekt** (backlog).
- Aucun fichier d'IDE (`.idea/`, `.kotlin/`) ni artefact de build en Git.
- Pas de `Toast` pour les erreurs métier → `Snackbar` Material 3 dans le Scaffold.

## 11. Accessibilité & terrain

- `contentDescription` sur toute icône porteuse de sens (`null` si décorative).
- Contraste suffisant : l'app est utilisée **en plein soleil**.
- Boutons principaux larges (`BigButton` existe : le réutiliser).
- Support du mode sombre (déjà présent dans `Theme.kt`) — le vérifier à chaque écran.
- L'app doit rester pleinement fonctionnelle **en mode avion**.
