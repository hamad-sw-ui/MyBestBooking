# Analyse d'erreurs — B-013 / B-140 (passe pré-compilation)

**Date** : 2026-07-28 · **Portée** : `MainRepository.backupDatabase` / `restoreDatabase`

| Indicateur | Valeur |
|---|---|
| Erreurs anticipées | 0 |
| Causes racines | 0 |
| Erreurs dérivées | 0 |
| Points vérifiés | 4 |
| Recompilations économisées | 0 (aucune erreur trouvée) |

## Points vérifiés avant compilation

| # | Point | Vérification | Verdict |
|---|---|---|---|
| a | `db.query(String, Array)` sur `RoomDatabase` | API publique Room, retourne `Cursor` | ✅ |
| b | `Cursor.use {}` sans import | `Cursor : Closeable` (API 16+) ; **précédent dans le projet** : `SmsSyncManager:30` utilise `cursor?.use {}` | ✅ |
| c | `FileChannel.use {}` | `FileChannel : Closeable` | ✅ |
| d | Interpolation `"${file.name}.tmp"` | syntaxe Kotlin standard | ✅ |

Aucune cause racine anticipée : le code n'introduit aucune API nouvelle pour le
projet et s'appuie sur des motifs déjà présents.

❓ *Hypothèse* : reste à confirmer par compilation réelle.
