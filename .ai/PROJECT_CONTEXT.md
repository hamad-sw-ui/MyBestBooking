# 🏪 CONTEXTE DU PROJET

## Identité

| Élément | Valeur |
|---|---|
| Dépôt | `hamad-sw-ui/MobileCaisse` |
| Nom Gradle | `CAISSE` (module unique `:app`) |
| Package / applicationId | `com.reconsiliation.caisse` |
| Nom affiché | **Mobile Caisse** |
| Version | `versionCode = 1`, `versionName = "1.0"` |
| Plateforme | Android natif, 100 % Kotlin + Jetpack Compose |
| minSdk / targetSdk / compileSdk | 24 / 35 / 35 |
| Langue de l'UI | **Français** (texte majoritairement codé en dur) |
| Marché visé | Cameroun (FCFA, MTN MoMo, Orange Money, n° à 9 chiffres commençant par 6) |
| Historique Git | 1 commit initial ; branche de travail `arena/019fa5ec-mobilecaisse` |

## À quoi sert l'application

Application de **caisse enregistreuse mobile** pour petits commerçants
(boutiques, boulangeries, bars, points de vente MoMo) en Afrique centrale.

Le différenciateur principal : **la réconciliation automatique des paiements
Mobile Money par lecture des SMS**. Quand un client paie par MTN MoMo ou
Orange Money, l'opérateur envoie un SMS de confirmation ; l'app le parse,
en extrait montant / ID de transaction / numéro, et le rapproche
automatiquement d'une vente. D'où le nom du package : `reconsiliation`.

## Fonctions métier couvertes

| Domaine | Contenu |
|---|---|
| **Ventes** | Panier, prix normal / VIP / détail, remise, taxe configurable, frais MoMo (MTN & Orange), paiement mixte espèces+MoMo, numéro de facture séquentiel `AAAA-NNNN`, retours et avoirs, verrouillage après clôture |
| **Stock** | Produits, catégories, unités, vente en vrac avec facteur de conversion, code-barres (ML Kit + CameraX), seuils d'alerte, mouvements, historique de prix, recettes (produits composés déduisant leurs ingrédients) |
| **Clients & dettes** | Fiches clients, statut VIP, crédits, remboursements, relances SMS, relevé de compte PDF |
| **Dépenses** | Saisie, catégories, rattachement à une session |
| **Fournisseurs** | Fiches, approvisionnements, dette fournisseur |
| **Caisse** | Sessions (ouverture/fermeture avec fonds de caisse), clôture de journée, inventaire (audit), écart théorique/réel |
| **SMS / MoMo** | Réception temps réel, rattrapage des SMS manqués, déduplication, file des SMS non reconnus à traiter manuellement |
| **Impression** | Ticket ESC/POS via Bluetooth, copie marchand, pied de ticket personnalisable |
| **Rapports** | Statistiques par période, export CSV, partage PDF, résumé quotidien |
| **Sécurité / accès** | PIN Manager et PIN Staff, rôles `MANAGER` / `STAFF`, routes protégées, verrouillage après tentatives, journal d'actions |
| **Sauvegarde** | Sauvegarde locale quotidienne (WorkManager), miroir sur stockage externe, export/partage manuel du `.db` |
| **Abonnement** | Licence hors-ligne signée HMAC liée au numéro de téléphone, activation par SMS de paiement, notifications d'expiration |

## Contraintes terrain (déterminantes pour les choix techniques)

- **Hors-ligne d'abord** : la connectivité est intermittente et coûteuse.
  → Aucune API serveur. Toute la donnée vit sur l'appareil.
- **Appareils modestes** : Android 7+ (minSdk 24), peu de RAM.
  → Éviter les recompositions lourdes et les requêtes non paginées.
- **Données financières irremplaçables** : pas de serveur = pas de restauration
  possible en cas de perte. → Migrations Room et sauvegardes = priorité absolue.
- **Vol / fraude interne** : l'appareil est manipulé par des employés.
  → Chiffrement SQLCipher, rôles, journal d'actions, détection d'anomalies.
- **Monétisation hors-ligne** : pas de Play Billing, licence vérifiée localement.
  → Compromis de sécurité assumé (voir `SECURITY.md`).

## État global (audit du 2026-07-28)

- ~**85 % des fonctionnalités métier sont écrites**.
- L'architecture est **monolithique** : 1 ViewModel, 1 Repository, pas de DI.
- **Bugs bloquants** dans les migrations Room (voir `BUGS.md`, BUG-001).
- **Build fragile** : `androidx.appcompat` non déclaré, `gradlew` non exécutable,
  `proguard-rules.pro` référencé mais absent.
- Couverture de tests quasi nulle sur le métier.

## Glossaire

| Terme | Sens |
|---|---|
| **Boutique** | Le commerce lui-même ; une seule ligne en base (id = 1), porte toute la configuration |
| **Vente** | Transaction de vente, éventuellement liée à un SMS MoMo |
| **Clôture** | Fermeture comptable de la journée ; verrouille les ventes |
| **Session** | Période de travail d'un employé avec fonds de caisse d'ouverture/fermeture |
| **Audit** | Inventaire physique comparé au stock théorique |
| **Orphan** | Paiement MoMo reçu sans vente correspondante |
| **Avoir** | Note de crédit émise lors d'un retour |
| **managerCode** | Code alphanumérique ≥ 12 caractères servant à dériver la clé SQLCipher |
