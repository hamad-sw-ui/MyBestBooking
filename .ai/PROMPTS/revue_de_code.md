# 👁️ PROMPT — REVUE DE CODE

```
Tâche : relire le diff <référence> avec les yeux d'un relecteur exigeant.

1. Lire .ai/CODING_RULES.md et .ai/ANDROID_RULES.md.
2. Lire le diff en entier AVANT de commenter.
3. Appliquer la grille ci-dessous.
4. Classer chaque remarque : 🔴 bloquant · 🟠 à corriger · 🟡 suggestion.
5. Conclure par un verdict explicite : APPROUVÉ / À CORRIGER / REFUSÉ.
```

---

## Grille de relecture

### Correction
- [ ] Le code fait ce que la tâche demande — ni plus, ni moins
- [ ] Cas limites traités (zéro, négatif, `null`, liste vide, très grand volume)
- [ ] Aucune régression sur les parcours existants
- [ ] Erreurs gérées, jamais avalées silencieusement

### Architecture
- [ ] Couches respectées (`UI → ViewModel → Repository → DAO`)
- [ ] Aucun accès base ni I/O depuis un Composable
- [ ] Aucun DAO appelé directement depuis un ViewModel
- [ ] `MainRepository` / `MainViewModel` n'ont pas encore grossi

### Kotlin
- [ ] Pas de `!!` injustifié, nullabilité maîtrisée
- [ ] `val` par défaut, structures immuables
- [ ] Concurrence structurée, pas de scope orphelin
- [ ] `CancellationException` préservée

### Compose
- [ ] `key` sur les listes, paramètres stables
- [ ] État hissé correctement
- [ ] Material 3 uniquement, couleurs issues du thème
- [ ] `contentDescription` sur les icônes signifiantes

### Room / SQL
- [ ] Schéma ⇄ migration cohérents, version incrémentée
- [ ] Test de migration présent
- [ ] Index sur les colonnes filtrées et les clés étrangères
- [ ] Transactions pour les opérations multi-tables
- [ ] Aucun SQL concaténé

### Sécurité
- [ ] Aucun secret ajouté au code
- [ ] Aucun PIN, clé ou SMS dans les logs
- [ ] Action sensible tracée dans `action_logs`
- [ ] Rôle requis correctement appliqué

### Qualité
- [ ] Nommage explicite et cohérent avec l'existant
- [ ] Aucune duplication (vérifiée par `grep`)
- [ ] Textes dans `strings.xml`
- [ ] Commentaires expliquant le *pourquoi*
- [ ] Diff minimal, sans reformatage parasite

### Documentation
- [ ] `.ai/` mis à jour (`PROGRESS`, `BACKLOG`, + fichiers de domaine)
- [ ] `BUGS.md` mis à jour le cas échéant

---

## Format de restitution

```markdown
## Revue — <référence>

**Verdict : APPROUVÉ | À CORRIGER | REFUSÉ**

### 🔴 Bloquant
- `fichier.kt:42` — <problème> → <correction attendue>

### 🟠 À corriger
- ...

### 🟡 Suggestions
- ...

### ✅ Points positifs
- ...
```

**Bloquant d'office sur ce projet** : modification de schéma sans migration
testée, secret en clair, accès base depuis l'UI, `catch` vide, régression sur
un parcours de vente.
