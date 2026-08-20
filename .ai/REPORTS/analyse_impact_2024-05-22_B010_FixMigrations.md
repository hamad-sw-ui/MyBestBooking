# Analyse d'Impact : B-010 (Correction des Migrations Divergentes)

**Niveau : C (Critique)** — Risque de crash au démarrage et perte de données.

## 1. Appelants directs
- `AppDatabase.kt` : Contient les objets `Migration`.

## 2. Appelants indirects
- Tout le projet dépend de l'ouverture réussie de la base.

## 3. ViewModels impactés
- Aucun directement, mais `MainViewModel` échouera à l'initialisation si `getDatabase` crash.

## 4. Écrans impactés
- `SplashScreen` : Premier point de crash potentiel.

## 5. Workers / Services impactés
- Tous les workers accédant à la base.

## 6. Tests existants
- `RoomMigrationTest.kt` (récemment ajouté) : Sera utilisé pour valider les corrections.

## 7. Nouveaux tests requis
- Étendre `RoomMigrationTest.kt` pour couvrir spécifiquement les tables en erreur (Boutique, Staff, Sessions, etc.).

## 8. Risques de régression
- **R1 (Données)** : Perte de colonnes si le SQL de migration est incorrect.
- **R2 (Nullabilité)** : Conflit entre `NOT NULL` en SQL et nullable en Kotlin (ex: `staff.pinSalt`).

## 9. Liste de revérification
- [ ] Vérifier la nullabilité de `pinSalt` dans la table `staff`.
- [ ] Vérifier les noms exacts des colonnes (`totalQuantityOnReceipt` vs `showTotalQuantityOnReceipt`).
- [ ] Vérifier les index uniques sur `categories` et `suppliers`.

## Commandes exécutées
N/A
