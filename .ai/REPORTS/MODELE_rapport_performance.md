# ⚡ MODÈLE — RAPPORT DE PERFORMANCE

> Copier en `rapport_performance_<AAAA-MM-JJ>.md`.

---

# Rapport de performance — AAAA-MM-JJ

**Commit** : `<sha>`
**Appareil de test** : <modèle, Android X, RAM>
**Jeu de données** : <ex. 5 000 ventes, 300 produits, 150 clients>

> ⚠️ Le marché cible utilise des appareils d'entrée de gamme. Toute mesure
> effectuée uniquement sur émulateur ou téléphone haut de gamme doit être
> signalée comme **non représentative**.

---

## 1. Synthèse

| Indicateur | Cible | Mesuré | Verdict |
|---|---|---|---|
| Démarrage à froid | < 2 s | | |
| Ouverture « Nouvelle vente » | < 300 ms | | |
| Validation d'une vente | < 500 ms | | |
| Ouverture de l'historique (5 000 ventes) | < 1 s | | |
| Écran Stock (300 produits) | < 500 ms | | |
| Génération d'un rapport mensuel | < 2 s | | |
| Taille de l'APK release | | | |
| Mémoire au repos | | | |

## 2. Méthode

```bash
# Démarrage à froid
adb shell am start -W -n com.reconsiliation.caisse/.MainActivity

# Frames sautées
adb shell dumpsys gfxinfo com.reconsiliation.caisse

# Mémoire
adb shell dumpsys meminfo com.reconsiliation.caisse

# Taille
./gradlew assembleRelease && ls -lh app/build/outputs/apk/release/
```

Outils : Android Studio Profiler, Layout Inspector (recompositions),
Database Inspector (plans de requête).

## 3. Base de données

| Requête | Durée | Index utilisé | Verdict |
|---|---|---|---|
| `getAllVentes()` | | | ⚠️ non bornée par conception |
| `getAllStock()` | | | |
| statistiques par période | | | |

- [ ] Aucune requête sur le thread principal
- [ ] `EXPLAIN QUERY PLAN` vérifié sur les requêtes coûteuses
- [ ] Aucun scan complet sur une table volumineuse
- [ ] Index présents sur les clés étrangères et colonnes filtrées

## 4. Interface Compose

| Écran | Recompositions | Frames sautées | Verdict |
|---|---|---|---|
| Accueil | | | |
| Nouvelle vente | | | |
| Stock | | | |
| Historique | | | |

- [ ] `key` sur toutes les `LazyColumn`
- [ ] Paramètres stables
- [ ] Aucun calcul lourd dans la composition

## 5. Mémoire

- [ ] Aucune croissance continue lors de la navigation répétée
- [ ] Aucune fuite après rotation × 10
- [ ] Aucun `Context` d'Activity retenu

## 6. Batterie et arrière-plan

- [ ] `BackupWorker` : durée d'exécution
- [ ] `SubscriptionWorker` : durée d'exécution
- [ ] `SmsReceiver` : traitement < 10 s
- [ ] Aucun réveil superflu

## 7. Goulots identifiés

| # | Zone | Cause | Impact | Correctif | Réf. |
|---|---|---|---|---|---|
| P1 | | | | | B-XXX |

## 8. Avant / après

| Indicateur | Avant | Après | Gain |
|---|---|---|---|
| | | | |
