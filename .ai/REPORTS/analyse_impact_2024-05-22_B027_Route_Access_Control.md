# Analyse d'Impact : B-027 (Centralisation du contrôle d'accès)

**Niveau : S (Structurant)** — Améliore la sécurité de la navigation.

## 1. Appelants directs
- `AppNavigation.kt` : Définition de la classe `Screen`.
- `MainViewModel.kt` : Fonction `requestAccess` et `isManagerPageRoute`.

## 2. Appelants indirects
- Tous les écrans déclenchant une navigation protégée.

## 3. ViewModels impactés
- `MainViewModel` : Sa logique de filtrage sera simplifiée.

## 4. Écrans impactés
- Tous.

## 5. Workers / Services impactés
- Aucun.

## 6. Tests existants
- Aucun test sur le contrôle d'accès.

## 7. Nouveaux tests requis
- Aucun test unitaire simple (nécessite Robolectric ou UI tests), mais validation par inspection du code.

## 8. Risques de régression
- **R1 (Accès refusé)** : Si un écran est marqué "Manager Only" par erreur, le personnel standard sera bloqué.

## 9. Liste de revérification
- [ ] Ajouter `isManagerOnly` à `Screen`.
- [ ] Supprimer la liste codée en dur dans `MainViewModel`.
- [ ] Vérifier que tous les écrans précédemment protégés le sont toujours.

## Commandes exécutées
N/A
