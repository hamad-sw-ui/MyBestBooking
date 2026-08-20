# 🏗️ MODÈLE — RAPPORT D'ARCHITECTURE

> Copier en `rapport_architecture_<AAAA-MM-JJ>.md`.
> À produire à chaque évolution structurelle (introduction de Hilt, découpage
> du repository, nouvelle couche).

---

# Rapport d'architecture — AAAA-MM-JJ

**Commit** : `<sha>`
**Évolution concernée** : <ex. introduction de Hilt (jalon 4)>

---

## 1. Synthèse

| Indicateur | Précédent | Actuel | Tendance |
|---|---|---|---|
| Fichiers Kotlin | 130 | | |
| Lignes de Kotlin | ~12 000 | | |
| Plus gros fichier | `MainRepository.kt` (992) | | |
| Fichiers > 400 lignes | 5 | | |
| Nombre de ViewModels | 1 | | |
| Nombre de repositories | 1 | | |
| Accès base depuis `ui/` | 5 | | 0 attendu |
| Classes dupliquées | 1 (`NotificationHelper`) | | 0 attendu |
| Injection de dépendances | aucune | | Hilt attendu |

```bash
find app/src/main -name "*.kt" | wc -l
find app/src/main -name "*.kt" | xargs wc -l | sort -n | tail -10
grep -rn "AppDatabase\.\|getDatabasePath" app/src/main/java/com/reconsiliation/caisse/ui/ | wc -l
```

## 2. Respect des couches

| Règle | Respectée ? | Violations |
|---|---|---|
| UI n'accède pas à la base | | |
| ViewModel n'appelle pas de DAO | | |
| Repository ne lance pas de coroutine | | |
| Aucune logique métier dans les Activities | | |
| Room uniquement via DAO | | |

## 3. Dépendances entre paquets

```
<schéma actualisé>
```

- [ ] Aucune dépendance circulaire
- [ ] `data/` ne dépend pas de `ui/`
- [ ] `utils/` ne dépend d'aucune couche métier

## 4. Cohésion et couplage

| Composant | Responsabilités | Verdict |
|---|---|---|
| `MainRepository` | | |
| `MainViewModel` | | |

Un composant assumant plus de 3 responsabilités distinctes doit être découpé.

## 5. Évolution depuis le rapport précédent

### Améliorations
-

### Régressions
-

### Dette technique introduite volontairement
| Dette | Justification | Échéance | Réf. |
|---|---|---|---|

## 6. Écarts restants avec l'architecture cible

| # | Écart | Impact | Réf. |
|---|---|---|---|
| A1 | | | B-XXX |

## 7. Recommandations

1.
2.

## 8. Mise à jour documentaire

- [ ] `ARCHITECTURE.md` reflète la structure réelle après cette évolution
- [ ] Le schéma des couches est à jour
- [ ] La liste des écarts (§11 de `ARCHITECTURE.md`) est recalculée
