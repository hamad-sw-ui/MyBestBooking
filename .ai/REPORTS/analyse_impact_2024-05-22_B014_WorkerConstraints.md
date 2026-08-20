# Analyse d'Impact : B-014 (Optimisation des Contraintes BackupWorker)

**Niveau : L (Local)** — Changement de configuration de planification.

## 1. Appelants directs
- `MainActivity.kt` : Contient la logique `WorkManager.enqueue`.

## 2. Appelants indirects
- `BackupWorker.kt` : Sera exécuté plus souvent.

## 3. ViewModels impactés
- Aucun.

## 4. Écrans impactés
- Aucun.

## 5. Workers / Services impactés
- `BackupWorker` : Ne sera plus bloqué par l'absence de réseau.

## 6. Tests existants
- Aucun test de planification.

## 7. Nouveaux tests requis
- Aucun.

## 8. Risques de régression
- Augmentation marginale de la consommation batterie si le worker tourne pendant que l'utilisateur travaille (compensé par la faible fréquence : 24h).

## 9. Liste de revérification
- [ ] Vérifier que `Constraints.Builder` n'appelle plus `setRequiredNetworkType`.

## Commandes exécutées
```bash
grep -rn "BackupWorker" app/src
```
