# 🧠 ÉTAT DU PROJET (STATE)

Ce document est la mémoire officielle du projet. Il est mis à jour à la fin de chaque cycle de développement.

## 📌 Identification
- **Projet** : MyBestBooking
- **Branche actuelle** : main
- **Dernier commit fonctionnel** : 61b616e44be68bb298f4784b54de259a8268a251
- **HEAD actuel** : b147f2f
- **Version du Framework** : 3.0.0 (AI-DOS, synchronisation documentaire en cours)

## 🛠️ État Technique
- **Dernière compilation** : 2026-08-23 (`npm run build` réussi)
- **Dernière validation runtime** : smoke Playwright 6/6 réussi ; `/api/health` attendu HTTP 200
- **Stack réelle** : Next.js 16 App Router, React 19, PostgreSQL, Drizzle ORM,
    Vitest et Playwright.
- **Fonctionnalités validées** : authentification JWT/TOTP, réservation avec
    contrôle de capacité, réservation invitée isolée, recherche dates/prix,
    favoris, avis intégrés, dashboard bulk et analytics corrigées.
- **Dette technique** : pagination SQL complète des résultats filtrés,
    remplacement des derniers `<img>`, vue mobile des tableaux dashboard,
    paiement fournisseur réel et suite Vitest live plus stable.

## 📋 Progression
- **Dernière tâche terminée** : audit fonctionnel runtime et corrections
    sécurité/UX du 2026-08-23.
- **Tâche en cours** : synchronisation documentaire de `.ai/`.
- **Prochaine tâche prévue** : stabiliser les tests d'intégration live et
    finaliser la pagination/recherche.

## 🐞 Bugs & Défauts
- **Bugs Ouverts (🔴/🟠/🟡)** : paiement mock, vérification email à durcir,
  pagination filtrée, responsive dashboard, test bulk dépendant d'un serveur live.
- **Bugs Corrigés (VALIDÉ)** : BUG-001, BUG-002, BUG-003, BUG-005, BUG-006, BUG-011, BUG-014, BUG-015, BUG-016, BUG-017, BUG-018, BUG-019, BUG-020, BUG-021, BUG-022, BUG-023, BUG-024, BUG-025, BUG-ENV-001.

## 🏛️ Décisions & Risques
- **Décisions d'architecture** :
        - Les règles critiques restent côté API ; l'interface ne remplace jamais
            les contrôles d'autorisation ou de disponibilité.
        - Les actions visibles doivent avoir un état chargement, erreur et succès.
        - Les filtres de recherche doivent être appliqués avant la pagination.
- **Risques connus** :
    - Dette de test (Platform) : Les propriétés internes des Intent ne sont pas inspectées en JVM pure.
    - Multi-ViewModel dans l\u0027UI : Devenu le motif standard pour les écrans transverses.

## 🕒 Dernière Mise à jour
- **Date** : 2026-08-23
- **Agent** : GitHub Copilot
