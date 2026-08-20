# Analyse d'Impact : B-025 (Sécurisation PRAGMA rekey)

**Niveau : C (Critique)** — Touche à la clé de chiffrement de la base de données.

## 1. Appelants directs
- `AppDatabase.kt` : Fonctions `performRekeyIfNecessary` et `forceRekey`.

## 2. Appelants indirects
- `MainRepository.kt` : `completeSetup` (indirectement via rekey au premier lancement).
- `SettingsScreen.kt` : via le changement de code manager.

## 3. ViewModels impactés
- Aucun directement.

## 4. Écrans impactés
- `SettingsScreen` : Lors du changement de code manager.

## 5. Workers / Services impactés
- Aucun.

## 6. Tests existants
- `SecurityMigrationTest` : Valide que le rekey fonctionne toujours.

## 7. Nouveaux tests requis
- Aucun, mais vérification de la validation des entrées.

## 8. Risques de régression
- **R1 (Accès DB)** : Si la validation est trop stricte ou si le format hexadécimal change, la base deviendra définitivement illisible.

## 9. Liste de revérification
- [ ] Vérifier que la regex `^[0-9a-fA-F]{64}$` couvre tous les cas de clés 256 bits.
- [ ] Centraliser le `execSQL` pour éviter les duplications.

## Commandes exécutées
N/A
