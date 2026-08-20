# 📐 RÈGLES DE CODE (non négociables)

Ces règles s'appliquent à **tout code nouveau**. Le code existant qui les viole
est recensé dans `BACKLOG.md` et corrigé progressivement, **jamais en masse au
milieu d'une autre tâche**.

---

## 1. MVVM obligatoire

```
Composable  →  ViewModel  →  Repository  →  DAO  →  Room
```

- Un Composable **ne connaît que son ViewModel**.
- Un Composable ne fait **jamais** : accès base, I/O fichier, `Intent`,
  `Context`-plomberie, calcul métier.
- Le ViewModel expose un état **immuable** (`StateFlow`) et des fonctions
  d'intention (`onValidateSale()`, `onQuantityChanged()`).
- ❌ Interdit : `AppDatabase.getDatabase(context)` dans `ui/`.
  (5 violations existantes : `SplashScreen`, `ClosureScreen`, `SettingsScreen`, …)

## 2. Repository obligatoire

- Toute donnée transite par un repository. Aucun DAO appelé depuis un ViewModel.
  ❌ Violations existantes : `MainViewModel` appelle `db.priceHistoryDao()`,
  `db.stockMovementDao()`, `db.staffDao()`, `db.customerDao()` directement.
- Un repository expose des `Flow` pour la lecture et des `suspend fun` pour l'écriture.
- Un repository **ne lance pas de coroutine** : il est appelé depuis un scope existant.
- Les nouveaux repositories sont **par domaine** (`SalesRepository`,
  `StockRepository`, `CustomerRepository`…), pas un nouveau god-object.

## 3. Pas de logique métier dans les Activities

- `MainActivity` ne doit contenir que : `setContent`, thème, edge-to-edge.
- Les permissions et la planification WorkManager migrent vers
  `CaisseApplication` / une couche dédiée.
- Aucune règle de calcul, aucun accès base dans une Activity.

## 4. Room uniquement via DAO

- Pas de `rawQuery`, pas de SQL construit par concaténation de chaînes.
  ❌ Violation existante : `PRAGMA rekey = '$passphrase'` (BUG-006).
- Toute requête est une méthode `@Query` annotée dans un `@Dao`.
- Toute opération multi-tables passe par `db.withTransaction { }`.
- Tout changement de schéma → migration **+ test de migration** (voir `DATABASE.md` §4).

## 5. Coroutines

- Concurrence structurée uniquement : `viewModelScope`, `lifecycleScope`,
  `CoroutineWorker`, `withContext`.
- ❌ Interdit : `GlobalScope`, `CoroutineScope(...)` créé à la volée sans annulation.
  Violation existante : `SmsReceiver` (BUG-009).
- Le choix du dispatcher appartient à la couche basse (`withContext(Dispatchers.IO)`
  dans le repository), **pas** à l'appelant.
- Les fonctions `suspend` sont *main-safe*.
- ❌ Interdit : `catch (e: Exception) { }` vide. Toujours logger **et** remonter
  un état d'erreur exploitable. Ne jamais avaler `CancellationException`.

## 6. Flow

- Lecture réactive = `Flow` du DAO → transformé dans le repository →
  `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initial)`.
- Côté Compose : `collectAsStateWithLifecycle()` (préférer à `collectAsState()`).
- Pas de `Flow` mutable exposé : `_x: MutableStateFlow` privé, `x: StateFlow` public.
- Pas de `.first()` dans un chemin réactif ; réservé aux one-shot.

## 7. Hilt

Cible d'architecture (voir `ROADMAP.md`, jalon 2) :

- `@HiltAndroidApp` sur `CaisseApplication`.
- `@AndroidEntryPoint` sur `MainActivity`.
- `@HiltViewModel` + `@Inject constructor` pour chaque ViewModel.
- `@Module @InstallIn(SingletonComponent::class)` pour `AppDatabase`, DAO,
  `PreferencesManager`, `EscPosPrinter`, repositories.
- `@HiltWorker` + `HiltWorkerFactory` pour `BackupWorker` et `SubscriptionWorker`.
- `EntryPointAccessors` pour `SmsReceiver` (BroadcastReceiver).
- ❌ Après ce jalon : plus aucun `new`/constructeur manuel de dépendance,
  plus aucune `ViewModelProvider.Factory` écrite à la main.

## 8. Material 3

- `androidx.compose.material3` uniquement. ❌ Pas de `material` (M2), pas de Views.
- Couleurs via `MaterialTheme.colorScheme`, jamais de `Color(0xFF...)` en dur
  dans un écran (les couleurs vivent dans `ui/theme/Color.kt`).
- Typographie via `MaterialTheme.typography`.
- Espacements en `dp` multiples de 4.
- Cibles tactiles ≥ 48 dp (usage terrain, souvent à une main).

## 9. Nommage cohérent

| Élément | Convention | Exemple |
|---|---|---|
| Entité Room | `XxxEntity` | `VenteEntity` |
| DAO | `XxxDao` | `VenteDao` |
| Repository | `XxxRepository` | `SalesRepository` |
| ViewModel | `XxxViewModel` | `NewSaleViewModel` |
| État d'écran | `XxxUiState` | `NewSaleUiState` |
| Écran Compose | `XxxScreen` | `NewSaleScreen` |
| Composant réutilisable | nom métier | `NumericKeypad` |
| Constante | `UPPER_SNAKE_CASE` | `PBKDF2_ITERATIONS` |
| Fonction | `lowerCamelCase`, verbe | `addVenteWithItems` |
| Booléen | `is…`, `has…`, `should…` | `isSetupComplete` |

⚠️ Le projet mélange français et anglais (`VenteEntity` / `StockEntity`,
`ventes` / `customers`). **Règle figée** : on **conserve** les noms existants
(renommer casserait la base). Pour tout **nouveau** symbole : **anglais** pour
le code technique, français pour le texte affiché.

## 10. Pas de duplication

- Avant de créer une classe/fonction : `grep -rn "<nom>" app/src`.
- ❌ Violation existante : deux `NotificationHelper` (`notification/` et `utils/`).
- Toute constante utilisée deux fois devient une constante nommée
  (statuts `"CONFIRMED"`, `"PENDING"`, rôles `"MANAGER"`, `"STAFF"` → **à passer en
  `enum class` ou objets de constantes**).
- Tout bloc de plus de ~15 lignes copié-collé est factorisé.

## 11. Code documenté lorsque nécessaire

- KDoc obligatoire pour : fonctions publiques de repository, algorithmes non
  évidents (`SmsParser`, `FeeCalculator`, `SecurityUtil`, `AnomalyEngine`),
  toute migration Room.
- KDoc **interdit** quand il paraphrase le nom (`/** Retourne le nom */`).
- Les commentaires expliquent le **pourquoi**, jamais le **quoi**.
- Langue des commentaires : **français** (cohérent avec l'existant).
- Tout `TODO` doit référencer une ligne du `BACKLOG.md` : `// TODO(BACKLOG-42): …`

## 12. Règles transverses

- **Aucun secret en dur** (clé, sel, numéro de téléphone privé). Voir `SECURITY.md`.
- **Aucun texte utilisateur en dur** dans du code neuf → `strings.xml`.
- **Aucun `!!`** sauf justification écrite en commentaire.
- **Aucun `println`** ; `android.util.Log` avec un TAG constant par classe.
- Les montants sont des `Double` (existant) — ne jamais comparer par `==` ;
  utiliser une tolérance. *(Migration vers `BigDecimal`/`Long` centimes : backlog P4.)*
- Fichier > 400 lignes = signal de découpage à consigner dans le backlog.


---

## 13. Définition de « terminé » — validation obligatoire (AI-DOS 3.0)

> **Une correction ou tâche n'est considérée comme VALIDÉE que si la chaîne de traçabilité est complète :**
> **Bug/Tâche → Analyse d'Impact → ADR (si requis) → Code → Build SUCCESS → Test SUCCESS → Documentation → TRACEABILITY.md.**

Si un seul de ces maillons manque, l'élément reste au statut `CORRIGÉ (INSPECTION)`.
Toute promotion vers `VALIDÉ` doit être justifiée dans la matrice de traçabilité.

Cette règle est **non négociable** et prévaut sur toute impression de complétude.

### 13.1 Écrire du code n'est pas corriger un bug

Un correctif non exécuté est une **hypothèse**, aussi solide soit le
raisonnement qui l'a produit. Le vocabulaire doit refléter cette différence :

| Formulation interdite ❌ | Formulation exigée ✅ |
|---|---|
| « BUG-018 est corrigé » | « BUG-018 : corrigé par inspection statique, en attente de compilation réelle » |
| « ça compile » | « non compilé — l'environnement ne le permet pas » |
| « les tests passent » | « 26 tests écrits, non exécutés » |
| « c'est terminé » | « livré, en attente de validation » |

**Précédent qui fonde cette règle** : `BackupManager` contenait quatre défauts
de sécurité *et* une erreur de type (`Result<Result<Unit>>`, BUG-023) qui le
rendait non compilable. Il avait pourtant été livré comme fonctionnel à l'issue
d'un audit de sécurité. **Un compilateur l'aurait détecté en une seconde ;
aucune relecture ne l'avait vu.**

### 13.2 Statuts autorisés

Voir l'échelle de `BUGS.md`. En résumé :

- `CORRIGÉ (INSPECTION)` — correctif écrit, **non exécuté**. État transitoire,
  jamais terminal. C'est une **dette de vérification**.
- `CORRIGÉ (VALIDÉ)` — compilation ✅ + tests ✅ + aucune régression ✅.
  **Seul statut autorisant la clôture.**

### 13.3 Chaîne de validation

```bash
make verify      # environnement Docker opérationnel
make validate    # compilation → analyses statiques → tests unitaires
make instrumented   # si le diff touche SQLCipher, Keystore, migrations ou UI
```

Un bug ne passe en `CORRIGÉ (VALIDÉ)` **qu'après** production des rapports
correspondants dans `.ai/REPORTS/`.

### 13.4 En cas d'échec

1. **Arrêter** l'intégration ;
2. **analyser** l'erreur — sans supposer qu'elle est bénigne ;
3. **corriger** ;
4. **relancer la chaîne complète**, pas seulement l'étape échouée ;
5. ne déclarer résolu qu'après réussite intégrale.

### 13.5 Quand l'environnement ne permet pas de valider

Si la compilation est impossible (absence de JDK, de SDK ou de Docker) :

- **le dire explicitement**, dans `PROGRESS.md` **et** dans la réponse au
  responsable ;
- marquer les bugs concernés `CORRIGÉ (INSPECTION)` ;
- fournir les **commandes exactes** permettant à un tiers de valider ;
- **ne jamais** présenter une inspection comme une preuve d'exécution.

### 13.6 Double validation des composants critiques

Pour tout composant critique — cryptographie, migrations de base, calculs
financiers, parsing SMS — **deux validations complémentaires sont exigées** :

| # | Validation | Ce qu'elle prouve | Ce qu'elle ne prouve pas |
|---|---|---|---|
| 1 | **Algorithmique indépendante** — implémentation de référence dans un autre langage (Python, table de vecteurs, oracle externe) | la **logique** et le **format** sont corrects | que le code Kotlin livré est correct |
| 2 | **Réelle en Kotlin** — tests exécutés dans Docker sur le code du projet | le **code livré** fonctionne | que la logique est juste, si les deux partagent le même malentendu |

Les deux sont **complémentaires, jamais interchangeables**. Une divergence entre
elles est un signal fort : l'une des deux implémentations est fausse.

**Précédent** : `tools/verification/verify_backup_format.py` réimplémente le
format d'archive v2 en Python et a **reproduit BUG-018** (`CT||TAG||TAG` →
`InvalidTag`) avant de valider le correctif. Cette validation a été possible
**sans JDK** — mais elle ne dispense pas d'exécuter `BackupManagerTest.kt`.

**Composants soumis à la double validation** :

| Composant | Validation indépendante | Validation Kotlin |
|---|---|---|
| `BackupManager` (crypto) | ✅ `verify_backup_format.py` — 16/16 | ⏳ 26 tests écrits, non exécutés |
| `SmsParser` | ⬜ jeu de SMS de référence à constituer | ⬜ B-090 |
| `FeeCalculator` | ⬜ barèmes officiels MTN/Orange | ⬜ B-091 |
| `SecurityUtil` (PBKDF2) | ⬜ vecteurs RFC 6070 | ⚠️ partiel |
| Migrations Room | ⬜ schémas JSON de référence (B-009) | ⬜ B-012 |
| `LicenseUtil` (HMAC) | ⬜ vecteurs HMAC-SHA256 | ⬜ B-092 |

Les harnais indépendants vivent dans `tools/verification/` et sont **conservés**
après usage : ils servent d'oracle anti-régression lors des évolutions.

---

## 14. Analyse d'impact obligatoire avant toute modification

> **Aucune modification de code ne commence avant qu'une analyse d'impact ait
> été rédigée et enregistrée dans `.ai/REPORTS/`.**

Objectif : qu'aucune modification ne soit réalisée sans comprendre précisément
**toutes les dépendances et tous les effets secondaires possibles**.

### 14.1 Les neuf questions obligatoires

Modèle : [`REPORTS/MODELE_analyse_impact.md`](REPORTS/MODELE_analyse_impact.md)

1. Quels fichiers utilisent **directement** le composant concerné ?
2. Quels composants l'utilisent **indirectement** ?
3. Quels **ViewModel** seront impactés ?
4. Quels **écrans** seront impactés ?
5. Quels **Workers ou Services** seront impactés ?
6. Quels **tests existants** couvrent déjà cette fonctionnalité ?
7. Quels **nouveaux tests** devront être créés ?
8. Quels **risques de régression** existent ?
9. Quels composants devront être **revérifiés** après la modification ?

Nom du fichier : `analyse_impact_<AAAA-MM-JJ>_<sujet>.md`.

### 14.2 L'analyse repose sur des faits, pas sur la mémoire

Chaque réponse doit s'appuyer sur une **commande exécutée**, citée dans le
rapport :

```bash
grep -rn "<Composant>" app/src --include=*.kt          # appelants directs
grep -rln "<Composant>" app/src/test app/src/androidTest   # tests existants
```

Répondre « aucun impact » sans l'avoir vérifié est une faute. Sur ce projet,
`MainRepository` (992 lignes) et `MainViewModel` (586 lignes) sont appelés par
une trentaine d'écrans : l'intuition y est systématiquement prise en défaut.

### 14.3 Points de contrôle propres à MobileCaisse

À passer en revue à chaque analyse, même si la réponse semble évidente :

| Point | Pourquoi |
|---|---|
| `MainViewModel` est **unique et partagé** | toute signature modifiée touche ~30 écrans |
| `BackupWorker`, `SubscriptionWorker`, `SmsReceiver` | s'exécutent **sans interface** : aucune saisie utilisateur possible |
| `SetupScreen` restaure le miroir au **premier lancement** | avant toute configuration : ni mot de passe, ni boutique |
| Format persisté modifié ? | les archives et bases **déjà produites** doivent rester lisibles |
| Correctifs de sécurité de `SECURITY.md` §0 | ne jamais les régresser |
| Fonctionnement **hors ligne** | ne jamais introduire de dépendance réseau implicite |

### 14.4 Après la correction — analyse d'impact post-correction

Après chaque **correction importante**, produire un rapport
**« Analyse d'impact post-correction »** qui confronte les conséquences réelles
aux conséquences prévues.

Modèle : [`REPORTS/MODELE_analyse_impact_post_correction.md`](REPORTS/MODELE_analyse_impact_post_correction.md)
Nom : `analyse_impact_post_<AAAA-MM-JJ>_<sujet>.md`

Il doit répondre à :
- les effets constatés correspondent-ils aux effets prévus ?
- quels fichiers ont été modifiés **hors** de ce qui était prévu, et pourquoi ?
- quels risques anticipés se sont matérialisés ?
- **quels effets n'avaient pas été anticipés ?** ← section la plus instructive
- la liste de revérification (§9) est-elle intégralement traitée ?

Un écart entre prévu et constaté n'est pas un échec : c'est une information sur
la qualité de l'analyse. **Le dissimuler, en revanche, en est un.**

### 14.5 Proportionnalité

| Nature de la modification | Analyse exigée |
|---|---|
| Correction de faute de frappe, commentaire, documentation | ⬜ aucune |
| Modification interne sans changement de signature | ✅ analyse allégée (questions 1, 6, 8) |
| Changement de signature publique, de format, de schéma | ✅ **analyse complète** |
| Suppression d'un composant | ✅ **analyse complète** + inventaire exhaustif des appelants |
| Correctif de sécurité ou de base de données | ✅ **analyse complète** + analyse post-correction |

En cas de doute : faire l'analyse complète. Elle coûte quelques minutes ; une
régression sur des données financières coûte bien davantage.

---

## 15. Workflow obligatoire des évolutions importantes

```
Audit → Lecture de .ai/ → Analyse du code réel → Analyse d'impact (§14)
  → Conception technique (§15.1) → Débat multi-rôles (§15.2)
  → Décision argumentée → Développement → Compilation → Tests → Validation (§13)
  → Analyse d'impact post-correction → Mise à jour de la documentation → Clôture
```

### 15.0 Proportionnalité — quelle profondeur pour quelle modification ?

> Le framework doit rester un **accélérateur**, pas un frein.
> Le niveau d'analyse est déterminé par l'**impact**, jamais par la taille du diff.

| Niveau | Nature de la modification | Impact (§14) | Conception (§15.1) | Débat (§15.2) | Opportunités (§15.3) |
|---|---|---|---|---|---|
| **T — Trivial** | typo, commentaire, documentation, renommage local privé | ⬜ | ⬜ | ⬜ | ⬜ |
| **L — Local** | refactor interne sans changement de signature, ajout de test | ✅ allégée (Q1, Q6, Q8) | ⬜ | ⬜ | ⬜ facultatif |
| **S — Structurant** | signature publique, nouvel écran, nouvelle dépendance | ✅ complète | ✅ | ⬜ sauf désaccord | ✅ |
| **C — Critique** | sécurité, chiffrement, schéma Room, migration, format persisté, logique financière, architecture | ✅ complète | ✅ | ✅ **obligatoire** | ✅ |

**Règles d'arbitrage**
- En cas de doute entre deux niveaux : **choisir le plus élevé**.
- Un correctif d'une ligne touchant la crypto ou une migration est **C**, pas T.
- Le niveau retenu est **écrit en tête** de l'analyse d'impact et justifié.
- Un niveau **T** ou **L** n'exempte jamais de §13 (compilation + tests).

### 15.1 Conception technique *(niveaux S et C)*

Document `REPORTS/analyse_conception_<AAAA-MM-JJ>_<sujet>.md`, produit **après**
l'analyse d'impact et **avant** toute écriture de code. Huit sections :

1. **Objectif** — pourquoi cette modification est nécessaire
2. **Problème actuel** — fonctionnement présent, limites, contraintes
3. **Solutions possibles** — **au minimum trois**, chacune évaluée sur :
   avantages · inconvénients · complexité · performances · sécurité ·
   maintenabilité · impact sur l'architecture
4. **Solution retenue** — argumentée par rapport aux autres
5. **Risques** — classés `Faible` · `Moyen` · `Élevé` · `Critique`
6. **Compatibilité** — rétrocompatibilité, migrations, impacts utilisateurs,
   données, performances
7. **Plan de développement** — petites étapes **validables individuellement**
8. **Plan de retour arrière** — comment revenir précisément à l'état antérieur

> Les trois solutions doivent être **réellement différentes** et sincèrement
> évaluées. Deux variantes cosmétiques d'une même approche ne comptent que pour
> une. Inclure « ne rien faire » quand c'est défendable.

Modèle : [`REPORTS/MODELE_analyse_conception.md`](REPORTS/MODELE_analyse_conception.md)

### 15.2 Débat technique multi-rôles *(niveau C, ou S en cas de désaccord)*

Document `REPORTS/debat_technique_<AAAA-MM-JJ>_<sujet>.md`.

Dix rôles minimum : Architecte · Dev Android senior · Expert Kotlin ·
Expert Compose · Expert Room · Expert Sécurité · Expert QA ·
Expert Performance · Expert DevOps · Relecteur.

Chacun fournit : **recommandations · objections · risques · alternatives**.

> ⚠️ **Les avis ne doivent jamais être artificiellement identiques.**
> Un débat où tout le monde approuve n'est pas un débat : c'est une signature
> collective sans valeur. Les rôles ont des intérêts structurellement
> divergents — la sécurité veut des contrôles, la performance veut de la
> vitesse, la QA veut de la testabilité, l'architecte veut de la pureté, le
> développeur veut livrer. **Les désaccords sont le produit attendu.**

Puis **synthèse**, puis **décision finale** expliquant :
- quels avis ont été **retenus**, et pourquoi ;
- quels avis ont été **écartés**, et pourquoi ;
- quels risques résiduels sont **acceptés**, et par qui.

> ⚠️ **Une objection émise en débat est une hypothèse, pas un fait.** Toute
> objection conduisant à créer une entrée dans `BUGS.md` doit d'abord être
> **vérifiée dans le code, commande à l'appui**. *(Règle issue de la
> rétrospective du 2026-07-28 : une objection sur le singleton `AppDatabase`
> s'était révélée fausse à la vérification.)*

Modèle : [`REPORTS/MODELE_debat_technique.md`](REPORTS/MODELE_debat_technique.md)

### 15.3 Recherche d'opportunités *(niveaux S et C)*

Toute analyse d'impact cherche aussi les **améliorations**, pas seulement les
défauts. Document `REPORTS/opportunites_<AAAA-MM-JJ>_<composant>.md`.

Onze axes à examiner systématiquement : simplification · réduction du volume de
code · performances · mémoire · batterie · lisibilité · testabilité · sécurité ·
maintenabilité · expérience utilisateur · architecture.

Chaque opportunité est chiffrée : **gain estimé · coût · priorité · risque**.

> 🚫 **Les opportunités ne sont jamais implémentées automatiquement.**
> Elles sont **proposées**, versées au backlog, et attendent un arbitrage.
> Les mêler à la tâche en cours diluerait le périmètre et rendrait toute
> régression impossible à attribuer.

Modèle : [`REPORTS/MODELE_opportunites.md`](REPORTS/MODELE_opportunites.md)

---

## 16. Honnêteté technique — classification des affirmations

Le framework ne masque jamais ses incertitudes. **Toute affirmation technique
est classée** dans l'une de ces six catégories :

| Marqueur | Catégorie | Force | Exemple |
|---|---|---|---|
| 🔍 | **Observé dans le code** | fait vérifiable | « `MainViewModel:463` appelle `syncToCloud` » |
| 🔨 | **Démontré par compilation** | fait | « le module compile sous JDK 21 » |
| 🧪 | **Démontré par tests** | fait | « 26/26 tests verts » |
| ▶️ | **Démontré par exécution** | fait | « l'export fonctionne sur un appareil API 24 » |
| 🧠 | **Déduit par raisonnement** | probable | « `NOT NULL` empêchera la migration paresseuse » |
| ❓ | **Hypothèse à vérifier** | incertain | « le build échouera sans doute sur AppCompat » |

**Règles**
- Une **hypothèse n'est jamais présentée comme un fait**.
- Une déduction, si solide soit-elle, ne devient un fait que par exécution.
- Dans un rapport, la catégorie est indiquée dès qu'un doute est possible.
- Sur les composants critiques, le tableau « démontré / non démontré » est
  explicite (voir `CURRENT_TASK.md`).

**Précédent** : `BackupManager` avait été livré comme fonctionnel après un audit
de sécurité. 🔍 Observation : il contenait `Result<Result<Unit>>`. 🧠 Déduction :
il ne compilait pas. Aucune de ces deux affirmations ne relevait du 🔨 — d'où la
requalification en `CORRIGÉ (INSPECTION)`.

---

## 17. Amélioration permanente du framework

Après **chaque tâche terminée**, analyser le processus lui-même et répondre par
écrit dans `PROGRESS.md` (section « Rétrospective ») :

1. Qu'est-ce qui a **bien fonctionné** ?
2. Qu'est-ce qui a **ralenti** le développement ?
3. Quelles **erreurs auraient pu être évitées** ?
4. Quelle **nouvelle règle** améliorerait le framework ?
5. Cette règle doit-elle devenir **permanente** ?

Si une amélioration est pertinente, la **proposer avant de passer à la tâche
suivante** — jamais l'imposer.

⚠️ **Subordonné à §20** : depuis le gel du framework (2026-07-28), une
rétrospective ne peut plus déboucher sur une nouvelle règle sans avoir répondu
aux sept questions de rentabilité. Dans la plupart des cas, la bonne réponse est
**« aucune nouvelle règle »**.

> ⚖️ **Contrepoids obligatoire** : cette règle ne doit pas produire une
> inflation de règles. À chaque proposition d'ajout, se demander si une règle
> existante peut être **fusionnée, simplifiée ou supprimée**. Un framework qui
> grossit sans cesse finit par être contourné — et un framework contourné ne
> protège plus rien.

---

## 18. Classification des propositions d'amélioration

> **Le développement est la priorité. Le framework est un outil à son service,
> non l'inverse.** *(décision du 2026-07-28)*

Toute proposition d'amélioration est classée dans **une** de ces catégories :

| Catégorie | Définition | Effet sur la roadmap |
|---|---|---|
| 🔴 **Bloquante** | Empêche de continuer : build cassé, perte de données, faille exploitable | ⛔ **interrompt** la roadmap |
| 🟠 **Critique** | Ne bloque pas immédiatement mais aggrave un risque majeur (sécurité, intégrité des données, régression silencieuse) | ⛔ **peut interrompre** la roadmap, sur arbitrage |
| 🟡 **Importante** | Vraie valeur, mais différable sans risque | → backlog |
| 🔵 **Confort** | Améliore le travail ou l'usage sans nécessité | → backlog |
| ⚪ **Cosmétique** | Formatage, nommage, présentation | → backlog |

**Règles**
- **Seules les catégories 🔴 Bloquante et 🟠 Critique peuvent interrompre la roadmap.**
- Les autres sont **automatiquement versées au backlog**, sans interrompre le
  développement ni demander d'arbitrage.
- La catégorie est indiquée à chaque proposition, dans les rapports
  d'opportunités comme dans le backlog.
- En cas d'hésitation entre 🟠 et 🟡 : choisir 🟡. L'interruption doit rester
  l'exception.

### Évolution du framework
Depuis le 2026-07-28, le framework **n'évolue plus par anticipation**. Une
nouvelle règle n'est ajoutée que si **un problème réel rencontré pendant le
développement** en démontre la nécessité — et la rétrospective (§17) doit alors
citer l'incident précis qui la justifie.

---

## 19. Traitement des échecs de compilation et de tests

> Objectif : **réduire le nombre de cycles « compiler → corriger → recompiler »**.
> Une compilation Android coûte plusieurs minutes ; chaque cycle évité est du
> temps de développement gagné.

### 19.1 Ne jamais s'arrêter à la première erreur
Lire **l'intégralité** du journal avant de corriger quoi que ce soit. La première
erreur affichée n'est pas nécessairement la cause racine, et corriger au fil de
l'eau produit des cycles inutiles.

### 19.2 Classer par cause racine
Regrouper toutes les erreurs par **origine commune**. Un import manquant peut
générer trente erreurs « unresolved reference » : c'est **une** cause, pas trente.

### 19.3 Distinguer causes et conséquences
Identifier les erreurs qui ne sont que des **dérivées** d'une autre. Elles
disparaîtront d'elles-mêmes et ne doivent pas être traitées séparément.

Indices d'une erreur dérivée :
- `unresolved reference` sur un symbole défini dans un fichier lui-même en erreur ;
- erreur de type en cascade après une signature incorrecte ;
- erreur KSP/Room consécutive à une entité qui ne compile pas.

### 19.4 Corriger ensemble les causes indépendantes
Toutes les causes racines **sans dépendance entre elles** sont corrigées dans la
**même itération**, dès lors que cela n'ajoute pas de risque. Deux causes sont
dépendantes si corriger l'une change la nature de l'autre.

### 19.5 Ne recompiler qu'après traitement de toutes les causes racines
Pas de recompilation « pour voir ». On recompile quand toutes les causes
identifiées sont traitées.

### 19.6 Rapport obligatoire après chaque build
Court, factuel, dans `.ai/REPORTS/analyse_erreurs_<date>.md` :

```markdown
| Indicateur | Valeur |
|---|---|
| Erreurs totales | N |
| Causes racines | N |
| Erreurs dérivées | N |
| Faux positifs écartés | N |
| Recompilations économisées | N |

## Ordre de correction recommandé
| Ordre | Cause | Justification |
```

### 19.7 Passe pré-compilation *(quand l'agent ne peut pas compiler)*
Si l'environnement ne permet pas de compiler, **anticiper** les causes racines
par analyse statique avant de solliciter un build extérieur.

**Cette passe est désormais automatisée** — ne plus la refaire à la main :

```bash
python3 software-factory/preflight/run.py --report
```

Voir `software-factory/README.md`. Tout nouveau motif d'erreur récurrent doit
être ajouté comme contrôle plutôt que revérifié manuellement (§20.2 : l'outil
prime sur la règle).

*Règle issue de la session du 2026-07-28 : cette passe a identifié 2 causes
racines et écarté 3 faux positifs avant la première compilation.*

---

## 20. Retour sur investissement des règles — le framework est STABLE

> **Statut au 2026-07-28 : framework GELÉ.**
> Le framework n'est plus un objectif. C'est un **moyen au service du
> développement**. L'objectif est désormais : livrer des fonctionnalités,
> corriger des bugs, améliorer l'application.

### 20.1 Toute nouvelle règle doit démontrer son rentabilité

Sept questions, à renseigner **avant** tout ajout :

| # | Question |
|---|---|
| 1 | Quel **incident réel** a révélé ce besoin ? |
| 2 | La règle est-elle **générale** ou spécifique à un seul cas ? |
| 3 | Combien de **défauts similaires** évitera-t-elle ? |
| 4 | Quel est son **coût** en temps de développement ? |
| 5 | Quel est son **bénéfice** estimé ? |
| 6 | Peut-elle être remplacée par l'**amélioration d'un outil existant** ? |
| 7 | Doit-elle être **permanente ou temporaire** ? |

**Si le bénéfice n'est pas clairement supérieur au coût, la règle n'est pas
ajoutée.** En cas d'égalité ou de doute : **ne pas ajouter**.

### 20.1bis Promotion des statuts — automatisée

La transition `CORRIGÉ (INSPECTION)` → `CORRIGÉ (VALIDÉ)` n'est plus manuelle :
`./software-factory/run` l'applique après un cycle vert, en vérifiant que les
preuves obtenues couvrent l'exigence de chaque bug. Un bug de compatibilité
API 24 reste en `INSPECTION` tant qu'aucun appareil API 24 n'a exécuté les tests.

### 20.2 Priorité à l'outil sur la règle

Une règle repose sur la discipline humaine ; un outil s'applique tout seul.
Avant d'écrire une règle, se demander si un **script**, un **test** ou une
**vérification automatisée** ferait le même travail.

*Exemple : plutôt qu'une règle « ne pas utiliser d'API supérieure à 24 », le
test `aucune API superieure a l API 24 n est utilisee` analyse le source et
échoue automatiquement. Une seule fois écrit, il protège pour toujours.*

### 20.3 Aucune règle par anticipation
Une règle n'est ajoutée que si **un incident survenu pendant le développement**
en démontre la nécessité. Pas de règle « au cas où ».

### 20.4 Contrepoids : le framework peut aussi maigrir
Toute proposition d'ajout s'accompagne de la question : **quelle règle existante
peut être fusionnée, simplifiée ou supprimée ?** Un framework qui ne cesse de
grossir finit contourné — et un framework contourné ne protège plus rien.

Indicateur de vigilance au 2026-07-28 : **4 394 lignes de `.ai/` pour 12 594
lignes de code** (ratio 35 %). Au-delà, la documentation devient un coût net.

---

### Application de §20 à elle-même

| # | Question | Réponse |
|---|---|---|
| 1 | Incident réel | 19 règles ajoutées en 9 sessions, dont plusieurs par anticipation. Ratio doc/code de 35 %. Une session entière (§7) sans une ligne de code produite. |
| 2 | Générale ? | ✅ Générale — elle gouverne toutes les règles futures. |
| 3 | Défauts évités | Toutes les futures règles non rentables. Sur le rythme constaté, plusieurs par mois. |
| 4 | Coût | ~10 min par proposition de règle. Nul s'il n'y a pas de proposition. |
| 5 | Bénéfice | Préserve la vélocité de développement, qui est désormais l'objectif principal. |
| 6 | Remplaçable par un outil ? | ❌ Non — c'est une règle de gouvernance, non automatisable. |
| 7 | Permanente ? | ✅ Permanente. |

**Verdict : bénéfice nettement supérieur au coût → règle adoptée.**

**Contrepoids appliqué (§20.4)** : §17 (amélioration permanente) faisait
double emploi avec §20. §17 est **conservée pour la rétrospective** — utile pour
apprendre — mais son volet « proposer une nouvelle règle » est désormais
**subordonné à §20**. Aucune règle nouvelle ne peut naître d'une rétrospective
sans passer les sept questions.

---

## 21. Enforcement de la Source de Vérité

Le dossier `.ai` est l'unique source de vérité du projet. Aucune action (analyse,
développement, commit) ne peut être entreprise sans une lecture vérifiable de
son contenu.

### 21.1 Protocole de début de session
Chaque session doit impérativement commencer par :
1.  **Vérification de l'existence** du dossier `.ai`.
2.  **Lecture de `INDEX.md`** et du manifeste.
3.  **Lecture des documents obligatoires** listés dans le manifeste.
4.  **Production d'un rapport de vérification** (Framework Verification).

### 21.2 Preuve par l'exemple
Toute affirmation sur le respect des règles ou de la roadmap doit citer un fait
spécifique ou un numéro de ligne issu des documents `.ai`.

---

## 22. Audit indépendant des preuves (Niveaux de confiance)

Toute affirmation technique importante doit être classée selon son niveau de
preuve. **AI-DOS ne déclare jamais un élément "VALIDÉ" si sa meilleure preuve
est de niveau C ou D.**

### 22.1 Niveaux de preuve
- **Niveau A — Preuve vérifiée** : Affirmation démontrée par une exécution réelle
  (build SUCCESS, tests au vert, APK généré, test instrumenté passé).
- **Niveau B — Preuve statique** : Affirmation démontrée par l'analyse du code ou
  de la configuration (lecture de script, annotation présente, règle ProGuard).
- **Niveau C — Déduction technique** : Affirmation raisonnablement déduite mais
  non encore démontrée (comportement attendu, performance supposée).
- **Niveau D — Hypothèse** : Affirmation nécessitant une validation future
  (comportement sur appareil physique, signature Release).

### 22.2 Format de qualification
Pour chaque point critique du rapport :
> **Affirmation** : [Texte]  
> **Niveau** : [A/B/C/D]  
> **Justification** : [Pourquoi ce niveau]  
> **Preuve** : [Lien vers log ou fichier]  
> **Limites** : [Ce qui n'est pas prouvé]  
> **Action restante** : [Ce qu'il faut faire pour monter de niveau]
