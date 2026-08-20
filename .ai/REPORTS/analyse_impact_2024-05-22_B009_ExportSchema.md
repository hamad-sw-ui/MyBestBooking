# Analyse d'Impact : B-009 (Activation Export Schema Room)

**Niveau : L (Local)** — Configuration du build.

## 1. Appelants directs
- `AppDatabase.kt` : Annotation `@Database`.
- `app/build.gradle.kts` : Configuration KSP/Room.

## 2. Appelants indirects
- Aucun.

## 3. ViewModels impactés
- Aucun.

## 4. Écrans impactés
- Aucun.

## 5. Workers / Services impactés
- Aucun.

## 6. Tests existants
- Aucun.

## 7. Nouveaux tests requis
- Aucun test de code. La validation est la présence des fichiers de schéma.

## 8. Risques de régression
- Aucun.

## 9. Liste de revérification
- [ ] Vérifier que `app/schemas/` contient un fichier `28.json` après compilation.

## Commandes exécutées
N/A
