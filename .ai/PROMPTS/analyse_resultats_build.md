# 🔬 PROMPT — ANALYSE DES RÉSULTATS DE BUILD ET DE TESTS

Procédure appliquée dès réception des sorties de `make verify`, `make validate`
ou `./docker/scripts/test.sh`. Objectif : convertir des correctifs
`CORRIGÉ (INSPECTION)` en `CORRIGÉ (VALIDÉ)` — ou repartir au travail.

---

## Procédure imposée (4 étapes)

```
1. ANALYSER les erreurs de compilation éventuelles
2. CORRIGER immédiatement les problèmes détectés
3. RELANCER toute la chaîne de validation
4. NE DÉCLARER résolu qu'après réussite complète
```

---

## Étape 1 — Analyser

### Lire la sortie dans le bon ordre
1. **La première erreur, pas la dernière.** En Kotlin, une erreur de type en
   cascade en produit dix : seule la première compte.
2. Fichier, ligne, colonne — les localiser dans le code réel avant d'interpréter.
3. Distinguer `e:` (erreur, bloquant) de `w:` (avertissement, non bloquant).
4. Distinguer une erreur **du correctif** d'une erreur **préexistante**
   (ex. BUG-003 `androidx.appcompat`, attendu, sans rapport avec `BackupManager`).

### Classer chaque erreur

| Type | Exemple | Réaction |
|---|---|---|
| **Erreur de mon correctif** | signature, type, import manquant | corriger immédiatement, priorité absolue |
| **Défaut préexistant révélé** | BUG-003 sur AppCompat | consigner dans `BUGS.md`, ne pas mélanger les chantiers |
| **Problème d'environnement** | SDK absent, licence refusée | corriger `docker/`, pas le code |
| **Test en échec** | assertion non satisfaite | 🔴 le plus instructif — voir étape 1bis |

### Étape 1bis — Un test qui échoue est une information, pas un obstacle

Avant de modifier quoi que ce soit, répondre par écrit :

- **Le test a-t-il raison ?** Si oui, le code est faux → corriger le code.
- **Le test est-il mal écrit ?** Alors corriger le test — **et expliquer
  pourquoi**, car un test faux masquait peut-être un vrai défaut.
- ❌ **Interdit** : affaiblir une assertion pour faire passer un test.
  Supprimer une vérification d'intégrité pour obtenir du vert est un mensonge
  outillé.
- **Divergence entre validation indépendante et tests Kotlin ?** Signal fort :
  l'une des deux implémentations est fausse. Enquêter **avant** de corriger.

---

## Étape 2 — Corriger

- Un correctif par cause racine ; ne pas grouper des problèmes sans lien.
- Ne pas en profiter pour refactorer.
- Si l'erreur révèle une faute de conception, le dire plutôt que de rustiner.
- Mettre à jour le harnais indépendant si le format évolue.

---

## Étape 3 — Relancer **toute** la chaîne

```bash
make verify
make validate
```

**Toute la chaîne, pas seulement l'étape échouée** : un correctif de compilation
peut casser un test qui passait.

Pour les composants critiques, relancer aussi la validation indépendante :

```bash
python3 tools/verification/verify_backup_format.py
```

---

## Étape 4 — Ne déclarer résolu qu'après réussite complète

Un bug passe en **`CORRIGÉ (VALIDÉ)`** si et seulement si :

- [ ] `make verify` — environnement validé
- [ ] compilation réelle réussie
- [ ] tests unitaires : **tous** verts
- [ ] aucune régression sur les tests préexistants
- [ ] tests instrumentés verts *si applicable* (SQLCipher, Keystore, migrations, UI)
- [ ] rapports présents dans `.ai/REPORTS/`
- [ ] double validation concordante pour un composant critique

Un seul point manquant ⇒ le statut **reste** `CORRIGÉ (INSPECTION)`.

---

## Format de compte rendu

```markdown
## Analyse des résultats — <date>

### Ce qui a réussi
- …

### Ce qui a échoué
| # | Erreur | Fichier:ligne | Origine | Gravité |
|---|---|---|---|---|
| 1 | | | mon correctif / préexistant / environnement | |

### Cause racine
<par erreur, sans spéculation>

### Correctifs appliqués
<un par cause>

### Statuts mis à jour
| Bug | Avant | Après | Justification |
|---|---|---|---|

### Chaîne relancée
<sorties, ou commandes à exécuter si l'agent ne peut pas>
```

---

## Cas particulier : `BackupManager` (attendu à la prochaine session)

Points de vigilance identifiés à l'écriture, à contrôler en priorité si la
compilation échoue :

| Risque | Emplacement | Vérification |
|---|---|---|
| `ByteArray.inputStream(offset, length)` | `decryptToStream` | existe bien dans `kotlin.io` |
| `recoverCatching` retournant `Nothing` | `exportBackupWithPassword` | le lambda `throw` — type `Nothing`, compatible `File` |
| Smart-cast sur `var` locale nullable | `importBackupWithPassword` | copies locales `manifestRaw`/`metaRaw`/`dbRaw` déjà en place |
| `CipherOutputStream` fermant le ZIP | `writeEncrypted` | protégé par `NonClosingOutputStream` |
| `updateAAD` avant `doFinal` | chiffrement/déchiffrement | ordre respecté des deux côtés |
| Sérialisation `@Serializable` + KSP | `BackupMetadata`, `BackupManifest` | plugin `kotlin-serialization` déjà appliqué |

Si les 26 tests passent : basculer BUG-018, 019, 021, 023 en `CORRIGÉ (VALIDÉ)`.
**BUG-020 reste `CORRIGÉ (INSPECTION)`** tant qu'aucune exécution sur un
appareil **API 24** n'a eu lieu — les tests JVM ne prouvent pas la
compatibilité Android réelle.
