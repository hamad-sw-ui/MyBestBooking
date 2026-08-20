# Analyse d'Impact : B-057 (Indexation et Clés Étrangères)

**Niveau : S (Structurant)** — Modification du schéma physique des tables.

## 1. Appelants directs
- `VenteItemEntity.kt`, `AuditItemEntity.kt` : Modification des annotations `@Entity`.
- `AppDatabase.kt` : Nouvelle migration v30.

## 2. Appelants indirects
- `VenteDao`, `AuditDao` : Amélioration des performances des jointures.

## 3. ViewModels impactés
- Aucun.

## 4. Écrans impactés
- Aucun (amélioration transparente).

## 5. Workers / Services impactés
- Aucun.

## 6. Tests existants
- `RoomMigrationTest.kt`.

## 7. Nouveaux tests requis
- Valider la migration v29 → v30.

## 8. Risques de régression
- **R1 (Données)** : Échec de la création de la ForeignKey si des items orphelins existent déjà en base.

## 9. Liste de revérification
- [ ] Vérifier que `auditId` dans `audit_items` pointe bien vers un ID existant dans `audits`.

## Commandes exécutées
N/A
