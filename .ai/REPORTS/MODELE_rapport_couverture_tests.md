# 🧪 MODÈLE — RAPPORT DE COUVERTURE DES TESTS

> Copier en `rapport_couverture_<AAAA-MM-JJ>.md`.
> À produire à chaque jalon de la roadmap.

---

# Rapport de couverture des tests — AAAA-MM-JJ

**Commit** : `<sha>`
**Outil de mesure** : <JaCoCo | comptage manuel>
**Commandes exécutées** :
```bash
./gradlew test
./gradlew connectedAndroidTest
```

> Si les tests n'ont **pas** pu être exécutés (absence de JDK/SDK/appareil),
> l'indiquer ici explicitement et marquer le rapport comme *estimation statique*.

---

## 1. Synthèse

| Indicateur | Valeur | Cible | Verdict |
|---|---|---|---|
| Tests unitaires | | | |
| Tests instrumentés | | | |
| Tests de migration | | 100 % des sauts | |
| Couverture globale de lignes | | | |
| Durée totale | | | |
| Tests en échec | | 0 | |
| Tests ignorés | | 0 | |

## 2. Couverture par paquet

| Paquet | Lignes | Couvertes | % | Cible |
|---|---|---|---|---|
| `utils/` | | | | 90 % |
| `sms/` | | | | 95 % |
| `data/repository/` | | | | 70 % |
| `data/local/` (migrations) | | | | 100 % des sauts |
| `ui/viewmodel/` | | | | 60 % |
| `ui/screens/` | | | | parcours critiques |

## 3. Couverture des zones à risque

| Zone | Risque métier | Couverte ? | Tests |
|---|---|---|---|
| Migrations Room | 🔴 perte de données | | |
| `SmsParser` | 🔴 ventes fantômes | | |
| Transaction de vente | 🔴 stock/caisse incohérents | | |
| `FeeCalculator` | 🟠 montants faux | | |
| `SecurityUtil` | 🟠 base illisible | | |
| `LicenseUtil` | 🟠 revenu | | |
| Clôture / sessions | 🟠 écarts de caisse | | |
| `AnomalyEngine` | 🟡 fraude | | |
| Sauvegarde/restauration | 🟠 sauvegarde inexploitable | | |

## 4. Zones non couvertes jugées acceptables

| Zone | Justification |
|---|---|
| | |

## 5. Zones non couvertes inacceptables

| Zone | Risque | Action | Réf. |
|---|---|---|---|
| | | | B-XXX |

## 6. Qualité des tests (au-delà du pourcentage)

- [ ] Les tests vérifient un **comportement**, pas une implémentation
- [ ] Les cas limites sont couverts (zéro, négatif, `null`, vide, très grand)
- [ ] Les chemins d'erreur sont testés, pas seulement le cas nominal
- [ ] Aucun test dépendant de l'horloge réelle ou de l'ordre d'exécution
- [ ] Aucun test fragile (*flaky*) toléré

## 7. Évolution

| Date | Tests unitaires | Instrumentés | Couverture |
|---|---|---|---|
| 2026-07-28 | 2 réels (+2 vides) | 1 réel (+1 vide) | ~0 % métier |

## 8. Plan d'amélioration

| Priorité | Tests à écrire | Réf. |
|---|---|---|
| 🔴 | | B-XXX |
