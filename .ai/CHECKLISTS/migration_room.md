# ✅ CHECKLIST — MIGRATION ROOM

🔴 **Le point le plus dangereux du projet.** Une migration ratée détruit des
données financières irremplaçables (aucun serveur, aucune restauration possible).

Six migrations existantes sont déjà défectueuses (BUG-001). Cette checklist
existe pour que cela ne se reproduise jamais.

---

## Avant d'écrire la migration

- [ ] `exportSchema = true` est actif et `app/schemas/` est versionné en Git
- [ ] Le schéma JSON de la version **courante** existe dans `app/schemas/`
- [ ] J'ai relu `DATABASE.md` §4
- [ ] Le changement de schéma est réellement nécessaire (une colonne nullable
      suffit-elle ? peut-on éviter de toucher au schéma ?)

## Écriture

- [ ] `version` de `@Database` incrémentée de **exactement 1**
- [ ] Classe `Migration(n, n+1)` créée
- [ ] Le SQL est **copié depuis le schéma JSON généré par Room**, jamais écrit de
      mémoire — c'est l'erreur exacte à l'origine de BUG-001
- [ ] Noms de colonnes **strictement identiques** à ceux de l'entité
      (rappel : `totalQuantityOnReceipt` ≠ `showTotalQuantityOnReceipt`)
- [ ] Types SQL corrects (`INTEGER` pour `Boolean` et `Date`, `REAL` pour
      `Double`, `TEXT` pour `String`)
- [ ] Nullabilité conforme (`NOT NULL` + `DEFAULT` pour un champ non nullable)
- [ ] Index recréés à l'identique (nom, unicité, colonnes)
- [ ] Clés étrangères recréées à l'identique (`onDelete`, `onUpdate`)
- [ ] Migration ajoutée à `addMigrations(...)`
- [ ] Aucun `fallbackToDestructiveMigration`

### Pour recréer une table (colonnes renommées ou supprimées)

```sql
-- 1. table temporaire au schéma cible
CREATE TABLE IF NOT EXISTS `x_new` (...);
-- 2. copie des données existantes
INSERT INTO `x_new` (col, ...) SELECT col, ... FROM `x`;
-- 3. suppression de l'ancienne
DROP TABLE `x`;
-- 4. renommage
ALTER TABLE `x_new` RENAME TO `x`;
-- 5. index
CREATE INDEX IF NOT EXISTS `index_x_y` ON `x` (`y`);
```
- [ ] Les données existantes sont **copiées**, jamais perdues
- [ ] Les colonnes disparues font l'objet d'une décision explicite (perte assumée
      et documentée, ou report des valeurs)

## Tests — obligatoires

- [ ] `MigrationTestHelper` configuré (`androidx.room:room-testing`)
- [ ] Test du saut `n → n+1`
- [ ] Test de la chaîne complète jusqu'à la version courante
- [ ] Test **avec données** : insérer en version `n`, migrer, vérifier ligne à ligne
- [ ] Test avec table vide
- [ ] `Room.databaseBuilder(...).build()` s'ouvre sans exception après migration
      (c'est ce contrôle qui déclenche `Migration didn't properly handle`)

```kotlin
@Test
fun migre_28_vers_29_en_conservant_les_ventes() {
    helper.createDatabase(TEST_DB, 28).apply {
        execSQL("INSERT INTO ventes (...) VALUES (...)")
        close()
    }
    val db = helper.runMigrationsAndValidate(TEST_DB, 29, true, MIGRATION_28_29)
    val c = db.query("SELECT amount FROM ventes")
    assertTrue(c.moveToFirst())
    assertEquals(5000.0, c.getDouble(0), 0.01)
}
```

## Vérification sur appareil

- [ ] Installer la version **précédente**, créer des données réalistes
      (ventes, stock, clients, dettes)
- [ ] Installer la nouvelle version **par-dessus** (sans désinstaller)
- [ ] L'application démarre sans crash
- [ ] Les données sont intactes et cohérentes
- [ ] Vérifié sur un appareil avec **base chiffrée SQLCipher** (pas seulement en mémoire)
- [ ] Sauvegarde/restauration toujours fonctionnelle après migration

## SQLCipher

- [ ] La migration n'interfère pas avec `performRekeyIfNecessary()`
- [ ] Testée sur une base chiffrée avec la clé Keystore **et** avec la clé legacy
      `ANDROID_ID`
- [ ] Aucune ouverture de la base hors du chemin `AppDatabase.getDatabase`

## Documentation

- [ ] `DATABASE.md` mis à jour : nouvelle version, entités modifiées, migration décrite
- [ ] Le schéma JSON généré est **committé**
- [ ] `PROGRESS.md` mentionne l'impact sur les bases existantes
- [ ] Le message de commit précise `fix(room)` / `feat(room)` + version

---

## 🚫 Interdits absolus

| Interdit | Pourquoi |
|---|---|
| `fallbackToDestructiveMigration()` en release | Efface les données du commerçant |
| Modifier une `@Entity` sans migration | Crash au démarrage pour tout utilisateur existant |
| Écrire le SQL de migration « de mémoire » | Cause exacte de BUG-001 |
| Sauter une version | La chaîne doit être continue |
| Livrer une migration non testée avec données | Perte irréversible |
| Modifier une migration **déjà publiée** | Les appareils l'ont déjà appliquée |
