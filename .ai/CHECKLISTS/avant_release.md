# ✅ CHECKLIST — AVANT RELEASE

Prérequis : `avant_commit.md` et `avant_pull_request.md` déroulées.

---

## 1. Build de production

- [ ] `versionCode` incrémenté, `versionName` cohérent
- [ ] `isMinifyEnabled = true` et `isShrinkResources = true` *(actuellement `false` — B-022)*
- [ ] `app/proguard-rules.pro` existe *(actuellement absent — B-002)*
- [ ] Règles keep présentes pour : Room, SQLCipher, kotlinx-serialization, ML Kit,
      entités Room, classes sérialisées
- [ ] `./gradlew assembleRelease` réussit
- [ ] L'APK/AAB release **démarre** sur un appareil réel (une release minifiée peut
      planter là où le debug fonctionne)
- [ ] Configuration de signature en place, keystore sauvegardé hors du dépôt
- [ ] Taille de l'APK mesurée et comparée à la version précédente

## 2. Données et migration

- [ ] Toutes les migrations testées (`CHECKLISTS/migration_room.md`)
- [ ] Mise à jour vérifiée **par-dessus la version précédente installée**, avec
      données réelles
- [ ] Sauvegarde et restauration fonctionnelles sur le build release
- [ ] `BackupWorker` s'exécute correctement (y compris hors ligne — BUG-015)

## 3. Sécurité

- [ ] `REPORTS/rapport_securite_<date>.md` à jour
- [ ] APK release décompilé : aucun secret trivialement lisible
- [ ] Générateur de clés de licence **absent** de l'APK client (B-023)
- [ ] `DataSeeder.seedSampleData()` inaccessible en release (B-026)
- [ ] `android:debuggable` absent, aucun log verbeux en release
- [ ] `allowBackup` audité (la base chiffrée ne doit pas fuiter via Google Backup)

## 4. Conformité Play Store

- [ ] Déclaration d'usage des permissions SMS (`READ_SMS`, `RECEIVE_SMS`)
      rédigée et argumentée — **motif de rejet fréquent**
- [ ] Politique de confidentialité publiée et référencée
- [ ] Formulaire « Sécurité des données » complété (données collectées :
      téléphone client, montants — stockées localement, non transmises)
- [ ] `targetSdk` conforme aux exigences en vigueur du Play Store
- [ ] Captures d'écran et description à jour

## 5. Tests de non-régression fonctionnels

Sur le **build release**, sur un appareil réel :

- [ ] Premier lancement : onboarding → configuration → PIN
- [ ] Vente en espèces + impression du ticket
- [ ] Vente MoMo + réconciliation SMS automatique
- [ ] Vente à crédit + remboursement
- [ ] Scan de code-barres
- [ ] Ajustement de stock, inventaire
- [ ] Clôture de journée
- [ ] Export CSV / partage PDF
- [ ] Activation d'abonnement par clé
- [ ] Sauvegarde puis restauration
- [ ] Bascule de rôle STAFF ↔ MANAGER
- [ ] **Mode avion** : l'application reste pleinement fonctionnelle
- [ ] Mode sombre sur les écrans principaux
- [ ] Testé sur un appareil ancien (Android 7–9) **et** récent

## 6. Documentation

- [ ] `.ai/PROGRESS.md` : entrée de release
- [ ] `.ai/BACKLOG.md` et `.ai/BUGS.md` à jour
- [ ] Notes de version rédigées
- [ ] Tag Git posé

## 7. Plan de repli

- [ ] Procédure de retour arrière définie
- [ ] ⚠️ Rappel : **une migration Room n'est pas réversible**. Si la version N+1
      migre le schéma, revenir à N est impossible sans restauration de sauvegarde.
      Le déploiement progressif (*staged rollout*) est donc obligatoire.
- [ ] Déploiement progressif configuré (5 % → 20 % → 100 %)
- [ ] Canal de remontée d'incident identifié
