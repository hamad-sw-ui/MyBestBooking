# Analyse d'Impact : B-022 (Activation R8 et Minification)

**Niveau : C (Critique)** — Impacte la structure binaire de l'APK et peut causer des crashs au runtime.

## 1. Appelants directs
- `app/build.gradle.kts` : Activation via `isMinifyEnabled`.
- `app/proguard-rules.pro` : Configuration des règles de conservation.

## 2. Appelants indirects
- Bibliothèques utilisant la réflexion : Room, SQLCipher, Kotlinx Serialization, ML Kit.

## 3. ViewModels impactés
- Aucun directement.

## 4. Écrans impactés
- Tous les écrans utilisant des données persistées ou sérialisées.

## 5. Workers / Services impactés
- `BackupWorker`, `SubscriptionWorker` (Serialization des backups).

## 6. Tests existants
- `BackupManagerTest` : Validera si la sérialisation JSON survit à R8.
- `RoomMigrationTest` : Validera si Room survit à R8.

## 7. Nouveaux tests requis
- Aucun, mais exécution des tests unitaires **avec minification activée** si possible.

## 8. Risques de régression
- **R1 (Runtime Crash)** : `ClassNotFoundException` ou `NoSuchMethodException` si une règle `keep` manque.
- **R2 (Serialization)** : Les champs JSON pourraient être renommés, rendant les sauvegardes illisibles.

## 9. Liste de revérification
- [ ] Vérifier que `kotlinx.serialization` fonctionne toujours.
- [ ] Vérifier que les entités Room sont conservées.
- [ ] Vérifier que SQLCipher charge ses bibliothèques natives.

## Commandes exécutées
N/A
