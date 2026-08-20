# Analyse d'Impact : B-024 (Dissimulation du SECRET_SALT)

**Niveau : S (Structurant)** — Impacte l'intégrité de la vérification de licence.

## 1. Appelants directs
- `LicenseUtil.kt` : Utilise `SECRET_SALT` pour le calcul du HMAC.

## 2. Appelants indirects
- `MainRepository.kt` : `activateSubscription`.

## 3. ViewModels impactés
- Aucun.

## 4. Écrans impactés
- Aucun.

## 5. Workers / Services impactés
- Aucun.

## 6. Tests existants
- Aucun test validant spécifiquement le HMAC (les tests existants couvrent la logique globale).

## 7. Nouveaux tests requis
- `LicenseUtilTest.kt` : 
    - [ ] Prouver que `verifyKey` fonctionne toujours avec le secret dissimulé.

## 8. Risques de régression
- **R1 (Invalidation)** : Si la reconstruction du secret à l'exécution produit une chaîne différente, toutes les licences existantes deviendront invalides.

## 9. Liste de revérification
- [ ] Vérifier que la chaîne finale reconstruite est strictement identique à `M0M0_C41SS3_V1_PRO_S3CR3T_2024_K3Y`.

## Commandes exécutées
N/A
