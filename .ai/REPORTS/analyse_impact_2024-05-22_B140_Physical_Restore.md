# Analyse d'Impact : B-013 / B-140 (Sécurisation de la Restauration Physique)

**Niveau : C (Critique)** — Touche à l'intégrité physique de la base de données.

## 1. Appelants directs
- `MainRepository.kt` : `backupDatabase`, `restoreDatabase`, `importEncryptedBackup`, `restoreMirrorBackup`.
- `MainViewModel.kt` : délègue à `MainRepository`.

## 2. Appelants indirects
- `SettingsScreen.kt` : via `MainViewModel.backupDatabase`.
- `RestorationWizardScreen.kt` : via `MainViewModel.importEncryptedBackup`.
- `SetupScreen.kt` : via `MainViewModel.restoreMirrorBackup`.
- `BackupWorker.kt` : via `MainRepository.backupDatabase`.

## 3. ViewModels impactés
- `MainViewModel` : Doit gérer le redémarrage de l'application (Splash) après une restauration réussie.

## 4. Écrans impactés
- `RestorationWizardScreen` : Affiche le succès et déclenche la navigation vers `Splash`.
- `SettingsScreen` : Idem pour l'export/import.

## 5. Workers / Services impactés
- `BackupWorker` : Utilise `backupDatabase`. Doit s'assurer que le WAL est bien checkpointé.

## 6. Tests existants
- Aucun test ne couvre la manipulation physique des fichiers `.db` sur le disque.

## 7. Nouveaux tests requis
- `DatabasePhysicalSecurityTest.kt` (Instrumented Test) :
    - [ ] Prouver que `checkpointWal` fonctionne.
    - [ ] Prouver que `restoreDatabase` utilise bien un fichier de staging.
    - [ ] Prouver que les fichiers `-wal` et `-shm` sont supprimés après restauration.
    - [ ] Prouver la résilience en cas d'échec de copie vers staging (la base originale doit rester intacte).

## 8. Risques de régression
- **R1 (Concurrence)** : Une tâche de fond (ex: parsing SMS) tentant d'accéder à la base pendant son remplacement.
- **R2 (Verrouillage)** : `db.close()` peut être bloqué par une transaction WAL longue.
- **R3 (Espace disque)** : Le fichier de staging double temporairement l'espace requis.

## 9. Liste de revérification
- [ ] Vérifier la suppression effective des fichiers `-wal` et `-shm`.
- [ ] Vérifier que `AppDatabase.INSTANCE` est bien remis à `null` après `close()` (pour forcer la réouverture sur le nouveau fichier).

## Commandes exécutées
```bash
grep -rn "backupDatabase" app/src
grep -rn "restoreDatabase" app/src
```
