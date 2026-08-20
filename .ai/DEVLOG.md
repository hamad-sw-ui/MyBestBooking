# 🪵 JOURNAL DE BORD (DEVLOG)

## 🗓️ 2026-08-19 — Extraction J5.8.2 (CustomerViewModel)
### Actions réalisées :
- **Extraction Domaine Clients** : Création de `CustomerViewModel` gérant `allCustomers`, `debtors`, `addRepayment` et `updateVipStatus`.
- **Migration SMS** : Ajout de `ShareManager.sendSms(phone, message)` utilisant `ACTION_VIEW`. Purge totale des imports `Intent` et `Uri` dans `DebtScreen` et `CustomerProfileScreen`.
- **Réduction monolithique** : `MainViewModel` descend à ~660 lignes.
- **Réorganisation Repository** : Déplacement de la méthode `updateCustomerVipStatus` de `MainRepository` vers `SalesRepository` pour respect des domaines.
- **Certification technique** : 4 nouveaux tests unitaires pour `CustomerViewModel` (Remboursement, VIP, Filtrage). Build OK.

---

## 🗓️ 2026-08-17 — Extraction J5.8.1 (InventoryViewModel)
### Actions réalisées :
- **Extraction Domaine Inventaire** : Création de `InventoryViewModel` gérant `allStock`, `lowStock`, `audits`, `categories`, `suppliers` et `supplies`.
- **Réduction monolithique** : `MainViewModel` descend à ~690 lignes.
- **Support des domaines** : `MainRepository` conserve la boutique globale et le personnel.
- **Certification technique** : 3 nouveaux tests unitaires pour `InventoryViewModel`. Build OK.

---

## 🗓️ 2026-08-16 — Finalisation J5.7 (NewSaleViewModel)
### Actions réalisées :
- **Extraction J5.7** : Migration totale de la logique de vente de `MainViewModel` vers `NewSaleViewModel`.
- **Gestion d\u0027état** : Implémentation de `NewSaleUiState` (Idle, Processing, Success, Error) pour orchestrer les confirmations de vente et les tickets.
- **Allégement ViewModel** : `MainViewModel` amputé de ~100 lignes de logique métier pure.
- **Validation** : Build SUCCESSFUL et tests unitaires (79/79) SUCCESS.

---

## 🗓️ 2026-08-14 — Refactor technique (B-052)
### Actions réalisées :
- **Correction B-052** : Migration des `Intent` Android du repository vers `ShareManager.kt` (platform).
- **Assainissement technique** : Suppression des dépendances `android.content.*` dans les repositories pour permettre les tests unitaires JVM purs.
- **Validation** : 75 tests SUCCESS.

---
*Fin du journal.*
