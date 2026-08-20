# 🚧 LIMITATIONS CONNUES

Ce document liste les limites **assumées** — choix de conception ou contraintes
externes — par opposition aux défauts corrigibles listés dans `BUGS.md`.
Ne pas les « corriger » sans décision produit explicite.

---

## 1. Aucun backend, aucune synchronisation multi-appareils

**Limite** : la base vit uniquement sur l'appareil. Deux téléphones = deux
caisses indépendantes, sans consolidation.

**Pourquoi** : marché à connectivité intermittente et coûteuse ; coût
d'exploitation d'un serveur incompatible avec le prix cible.

**Conséquences** :
- Perte du téléphone = perte des données non sauvegardées manuellement.
- Impossible de gérer plusieurs points de vente d'un même commerçant.
- La « sync cloud » n'est qu'un partage de fichier `.db` par Intent.

**Voie de sortie** : ✅ **D2 tranchée (2026-07-28)** — deux volets en parallèle :
renommage honnête de l'existant (B-110) et vraie sauvegarde automatique distante
via Google Drive (B-111/B-112). Voir
`REPORTS/rapport_analyse_2026-07-28_sauvegarde_distante.md`.
La limite « pas de synchronisation multi-appareils » reste néanmoins entière :
une sauvegarde distante n'est pas une synchronisation.

---

## 2. Licence hors-ligne intrinsèquement contournable

**Limite** : la vérification d'abonnement est purement locale (HMAC-SHA256 avec
un sel embarqué). Un utilisateur déterminé peut la neutraliser.

**Pourquoi** : pas de serveur de licence, et Play Billing est inadapté (achat
souvent via Mobile Money, hors Play Store).

**Atténuation possible** : R8, obfuscation, sortie du secret du code clair
(B-022 à B-024). **La protection restera imparfaite par construction** —
c'est un choix économique, pas un oubli.

---

## 3. Parsing SMS heuristique, jamais fiable à 100 %

**Limite** : les opérateurs modifient leurs libellés sans préavis.
`SmsParser` fonctionne par scoring et peut manquer un paiement ou en
mal-interpréter un.

**Atténuations en place** : seuil de score élevé (50), exigence
montant **et** ID de transaction, drapeau `isSecure`, file `sms_errors` pour
traitement manuel, déduplication par `transactionId`.

**Conséquence** : la réconciliation reste **assistée**, jamais entièrement
automatique. Le commerçant doit contrôler la file des SMS non reconnus.

---

## 4. Portée géographique : Cameroun uniquement

Codé en dur dans le produit :
- format de numéro `6[25-9]\d{7}` (`PhoneUtil`, `SmsParser`) ;
- devise FCFA par défaut ;
- barèmes de frais MTN / Orange Cameroun (`FeeCalculator`) ;
- expéditeurs SMS officiels camerounais.

Toute extension régionale exige une couche de configuration par pays.

---

## 5. Barèmes de frais Mobile Money approximatifs

`FeeCalculator` applique des pourcentages arrondis (MTN retrait ≈ 1 % + 0,2 % + 4 F ;
Orange retrait ≈ 1,5 %). Les grilles réelles sont **par tranches** et évoluent.

**Conséquence** : les frais affichés sont indicatifs. Ils ne doivent pas servir
de référence comptable officielle.

---

## 6. Montants en `Double`

Toutes les entités stockent les montants en `Double` (virgule flottante).
Risque d'erreurs d'arrondi sur les cumuls.

**Atténuation** : en FCFA il n'y a pas de centimes, les montants sont entiers et
les écarts restent négligeables à l'échelle d'une boutique.

**Voie de sortie** : B-077 (passage à `Long`) — migration coûteuse touchant
toutes les tables ; non prioritaire.

---

## 7. Un seul point de vente par installation

La table `boutique` contient une **ligne unique** (`id = 1`). Le modèle ne
supporte ni plusieurs boutiques, ni plusieurs caisses simultanées.

---

## 8. Scanner de code-barres dépendant des Google Play Services

ML Kit passe par `play-services-mlkit-barcode-scanning`. Sur un appareil sans
GMS (fréquent sur l'entrée de gamme importé), le scan est indisponible.

**Atténuation** : la saisie manuelle du code-barres reste possible partout.

---

## 9. Impression limitée aux imprimantes ESC/POS Bluetooth

Pas d'USB, pas de Wi-Fi, pas de partage réseau. L'adresse MAC est stockée en
configuration : changer d'imprimante impose de la reconfigurer.

---

## 10. Sécurité physique de l'appareil

Le chiffrement SQLCipher protège le **fichier** de base. Il ne protège pas
contre :
- un appareil déverrouillé laissé sans surveillance ;
- un appareil rooté (Keystore contournable) ;
- un employé connaissant le PIN Manager.

Les contre-mesures sont **organisationnelles** (rôles, journal d'actions,
détection d'anomalies), pas cryptographiques.

---

## 11. minSdk 24 — API modernes indisponibles

Pas de `EncryptedSharedPreferences` sans compromis, contraintes sur les API de
fichiers et de notifications, et **fragmentation forte** du comportement
Bluetooth et SMS entre Android 7 et 15. Tout code doit être testé sur au moins
un appareil ancien.

---

## 12. Interface monolingue française codée en dur

~99 % des textes sont écrits directement dans les Composables.
Traduire l'application demandera une passe complète d'externalisation
(B-073/B-074), pas un simple fichier de traduction.

---

## 13. Environnement de développement de l'agent non outillé

L'environnement d'exécution de l'agent ne dispose **ni de JDK ni de SDK
Android**. Les vérifications sont **statiques** (lecture, `grep`, analyse de
schémas). Toute affirmation du type « ça compile » doit venir d'une exécution
réelle par le responsable ou par la CI.
