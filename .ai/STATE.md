# 🧠 ÉTAT DU PROJET (STATE)

Ce document est la mémoire officielle du projet. Il est mis à jour à la fin de chaque cycle de développement.

## 📌 Identification
- **Projet** : MobileCaisse
- **Branche actuelle** : arena/019fa5ec-mobilecaisse
- **Dernier commit fonctionnel** : 61b616e44be68bb298f4784b54de259a8268a251
- **HEAD actuel** : 61b616e44be68bb298f4784b54de259a8268a251
- **Version du Framework** : 3.0.0 (AI-DOS + Evidence Audit)

## 🛠️ État Technique
- **Dernière compilation** : 2026-08-19 (SUCCESS)
- **Dernière exécution des tests** : 2026-08-19 (86/86 SUCCESS)
- **Couverture actuelle** : 
    - BackupManager (100% logique)
    - SmsParser (100% logique métier)
    - FeeCalculator (100% logique calculs MoMo)
    - LicenseUtil (100% logique HMAC)
    - AnomalyEngine (100% logique détection fraude)
    - Repositories (Data pure : Sales, Inventory, Main)
    - Platform (Services Framework : ReportManager, PrinterManager, ShareManager)
    - ViewModels (Orchestration : MainViewModel, NewSaleViewModel, InventoryViewModel, CustomerViewModel)
- **Dette technique** :
    - `MainViewModel` allégé (~660 lignes) mais encore responsable des Ventes et Sessions.
    - Découpage architectural en cours (J5.8.2 terminé, J5.8.3 à suivre).

## 📋 Progression
- **Dernière tâche terminée** : J5.8.2 - Extraction CustomerViewModel (CLÔTURÉ).
- **Tâche en cours** : Synchronisation documentaire.
- **Prochaine tâche prévue** : J5.8.3 - Étendre le découpage architectural (Sessions, Dépenses...).

## 🐞 Bugs & Défauts
- **Bugs Ouverts (🔴/🟠/🟡)** : BUG-004, BUG-007, BUG-008, BUG-009, BUG-010, BUG-012, BUG-013.
- **Bugs Corrigés (VALIDÉ)** : BUG-001, BUG-002, BUG-003, BUG-005, BUG-006, BUG-011, BUG-014, BUG-015, BUG-016, BUG-017, BUG-018, BUG-019, BUG-020, BUG-021, BUG-022, BUG-023, BUG-024, BUG-025, BUG-090, BUG-091, BUG-092, BUG-093, B-094A, BUG-ENV-001.

## 🏛️ Décisions & Risques
- **Décisions d'architecture** : 
    - Découpage ViewModel : Chaque domaine fonctionnel doit posséder son propre ViewModel.
    - Autonomie de `CustomerViewModel` : Gère Clients, Dettes et Rappels.
    - Migration Intent SMS : Utilisation de `ShareManager.sendSms()` (ACTION_VIEW) pour supprimer les dépendances UI directes tout en préservant l'UX.
- **Risques connus** : 
    - Dette de test (Platform) : Les propriétés internes des Intent ne sont pas inspectées en JVM pure.
    - Multi-ViewModel dans l\u0027UI : Devenu le motif standard pour les écrans transverses.

## 🕒 Dernière Mise à jour
- **Date** : 2026-08-19
- **Agent** : AI-DOS Independent Auditor
