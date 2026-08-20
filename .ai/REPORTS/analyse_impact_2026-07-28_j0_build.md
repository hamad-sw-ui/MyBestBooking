# Analyse d'impact — J0 : build propre (allégée)

**Date** : 2026-07-28 · **Réf.** : B-001→B-008, B-100, B-110
**Niveau** : **L — Local** *(changements mécaniques, aucune logique métier)*
→ conception et débat non requis (§15.0).

**Exception** : B-003 est classé **S** (change la classe de base de l'Activity).
Traité ci-dessous.

---

## Pourquoi J0 passe avant l'étape 1

🧠 *Déduit* : BUG-003 empêche la compilation du **module entier**. Or la
validation de `BackupManager` (étape 1) exige `./gradlew testDebugUnitTest`,
donc une compilation réussie. **J0 est un prérequis de l'étape 1**, pas une
digression.

## 1. Fichiers utilisant directement les composants modifiés

```bash
grep -rn "AppCompat" app/src/main --include=*.kt --include=*.xml
# → MainActivity.kt:8 (import), :18 (classe), themes.xml:3 (parent)
```

**3 occurrences, aucun usage fonctionnel** : ni `supportActionBar`, ni
`delegate`, ni `AppCompatDelegate`. La dépendance est purement déclarative.

## 2–5. Composants impactés

| Question | Réponse |
|---|---|
| Indirects | `MainActivity` est le point d'entrée unique → toute l'app démarre par lui |
| ViewModel | ❌ aucun — `MainViewModel` est obtenu par `viewModel()`, indifférent à la classe d'Activity |
| Écrans | ❌ aucun — `setContent` est fourni par `ComponentActivity`, pas par AppCompat |
| Workers/Services | ❌ aucun |

## 6. Tests existants

```bash
grep -rln "MainActivity" app/src/test app/src/androidTest
# → ExampleInstrumentedTest.kt (vérifie seulement le nom du package)
```
Aucun test ne dépend d'`AppCompatActivity`.

## 7. Nouveaux tests

Aucun test unitaire pertinent : le changement est structurel. Validation par
**compilation** + lancement de l'application.

## 8. Risques de régression

| # | Risque | Prob. | Grav. | Atténuation |
|---|---|---|---|---|
| R1 | `Theme.Material3` indisponible sans dépendance `material` (Views) | Moyenne | 🟠 | Utiliser `android:Theme.Material.Light.NoActionBar` (plateforme, API 21+) ou `Theme.AppCompat` conservé |
| R2 | La status bar change d'apparence | Faible | 🟡 | `Theme.kt` la pilote déjà via `SideEffect` |
| R3 | `enableEdgeToEdge()` incompatible | Nulle | — | Fourni par `androidx.activity`, indépendant d'AppCompat |
| R4 | Un dialogue Compose perd son thème | Faible | 🟡 | Les dialogues Compose n'héritent pas du thème XML |

🔍 *Observé* : `Theme.kt` définit déjà entièrement les couleurs Material 3 et
pilote la status bar. Le thème XML ne sert qu'au **splash système** avant que
Compose ne prenne la main.

**Décision R1** : utiliser `android:Theme.Material.Light.NoActionBar` — thème de
la **plateforme**, disponible depuis l'API 21, **zéro dépendance ajoutée**.
Écarte à la fois AppCompat et le besoin de `com.google.android.material`.

## 9. Composants à revérifier

- [ ] L'application démarre (`MainActivity`)
- [ ] Le thème clair/sombre fonctionne
- [ ] La status bar garde sa couleur de marque
- [ ] `enableEdgeToEdge` fonctionne toujours
- [ ] Les permissions sont toujours demandées

---

**Le développement peut commencer** : ☑ **oui**
