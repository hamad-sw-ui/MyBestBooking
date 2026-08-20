# Rapport d'analyse — Sauvegarde distante (décision D2, volet 2)

**Date** : 2026-07-28
**Périmètre** : `BackupManager`, `MainRepository.syncToCloud`, `BackupWorker`, `SettingsScreen`
**Réf. backlog** : B-110, B-111, B-112 · **Dépend de** : B-101 (BUG-017)
**Statut** : proposition — **en attente d'arbitrage**

---

## 1. Question posée

Comment doter MobileCaisse d'une vraie sauvegarde automatique distante, sachant
que l'application est hors-ligne par conception et que la connectivité du marché
cible est intermittente et coûteuse ?

## 2. État actuel vérifié

| Élément | Réalité du code |
|---|---|
| `MainRepository.syncToCloud()` | Copie le `.db` dans `cacheDir`, puis `Intent.ACTION_SEND` via `FileProvider`. Titre affiché : « Synchroniser vers le Cloud / Email ». **Aucun upload.** |
| Bouton `SettingsScreen:119` | Libellé « Sauvegarder / Migrer (DB) », section « Données & Migration » |
| `logAction("CLOUD_SYNC", "Sauvegarde cloud initiée")` | Vocabulaire trompeur |
| `BackupWorker` | Copies locales + miroir externe. Exige `NetworkType.CONNECTED` **sans rien envoyer** (BUG-015) |
| `BackupManager` | PBKDF2 100k + AES-GCM + checksum + ZIP — **jamais appelé** (BUG-017) |

**Constat central** : le projet possède déjà une brique de sauvegarde chiffrée de
qualité professionnelle, mais elle n'est reliée à rien. Toute solution distante
doit s'appuyer dessus, jamais téléverser un `.db` brut.

---

## 3. Volet 1 — Renommage honnête (B-110, immédiat)

Périmètre strictement cosmétique, **sans toucher à la logique** (consigne D2).

| Emplacement | Actuel | Proposé |
|---|---|---|
| `SettingsScreen:125` | « Sauvegarder / Migrer (DB) » | **« Exporter et partager la base »** |
| Section `SettingsScreen:116` | « Données & Migration » | « Sauvegarde & Export » |
| `MainRepository:902` chooser | « Synchroniser vers le Cloud / Email » | **« Exporter et partager »** |
| `MainRepository:903` `logAction` | `CLOUD_SYNC` / « Sauvegarde cloud initiée » | `EXPORT_SHARE` / « Export manuel de la base initié » |
| `MaintenanceScreen:100` | « …fait une sauvegarde cloud avant » | « …fait un export de sauvegarde avant » |
| `MainRepository:892` fichier | `caisse_cloud_sync_<ts>.db` | `caisse_export_<ts>.db` |

⚠️ Le renommage de la **fonction** `syncToCloud` → `exportAndShare` touche
`MainViewModel:463` et `SettingsScreen:119`. Techniquement trivial, mais je le
propose **en option** : la consigne dit « sans toucher au code existant ».
👉 **À arbitrer** : renommage des libellés seuls, ou libellés + identifiants ?

---

## 4. Volet 2 — Service de stockage distant

### 4.1 Prérequis bloquant

**B-101 doit être fait avant** : ce qui part sur le réseau doit être une archive
`BackupManager` (chiffrée par mot de passe utilisateur, avec checksum), jamais
un `.db` brut. Téléverser le fichier SQLCipher tel quel reviendrait à déporter
la sécurité sur la seule robustesse du `managerCode`.

### 4.2 Comparatif

| Critère | **Google Drive** | **Dropbox** |
|---|---|---|
| Compte déjà présent sur l'appareil | ✅ Quasi systématique sur Android | ❌ Installation et création de compte requises |
| Authentification | Google Sign-In + Drive REST v3 (`drive.appdata`) | OAuth 2.0 PKCE, SDK officiel |
| Portée minimale | `drive.appdata` — **dossier privé invisible**, ne pollue pas le Drive | `files.content.write` sur un dossier applicatif |
| Quota gratuit | 15 Go partagés | 2 Go |
| Dépendance GMS | ⚠️ **Oui** — inutilisable sans Play Services (même limite que ML Kit) | ✅ Non |
| Poids ajouté à l'APK | ~2–3 Mo (`play-services-auth` + client Drive) | ~1,5 Mo |
| Complexité d'intégration | Moyenne — OAuth Google verbeux, vérification Play Console si portée large | Faible — SDK bien documenté |
| Coût pour le commerçant | Nul | Nul (jusqu'à 2 Go) |
| Adéquation marché CM | ✅ Excellente — compte Google déjà là, zéro friction | ⚠️ Faible notoriété |

### 4.3 Option C — ni l'un ni l'autre : `ACTION_CREATE_DOCUMENT` (SAF)

Le **Storage Access Framework** permet à l'utilisateur de choisir sa destination
(Drive, Dropbox, OneDrive, carte SD…) **sans aucune dépendance ni OAuth**.

- ✅ Zéro dépendance, zéro clé d'API, zéro configuration console
- ✅ Fonctionne sans GMS
- ✅ Compatible avec tous les fournisseurs
- ❌ **Ne permet pas la sauvegarde automatique en arrière-plan** — c'est
  précisément ce qui est demandé

→ Excellent complément, insuffisant comme réponse à D2.

---

## 5. Analyse par rôle

| Rôle | Verdict | Réserve principale |
|---|---|---|
| Architecte | ⚠️ | Introduit la première dépendance réseau du projet : imposer une interface `RemoteBackupStorage` pour rester substituable |
| Dev Android senior | ⚠️ | `WorkManager` avec contraintes réseau réelles, backoff exponentiel, reprise après échec |
| Expert Kotlin | ✅ | `suspend` + `Result`, pas de callback |
| Expert Room | ✅ | Aucun impact schéma si l'on téléverse une archive `BackupManager` |
| Expert Compose | ✅ | Un écran de configuration + un indicateur d'état de dernière sauvegarde |
| Expert Hilt | ⚠️ | À faire **après J4** : le client distant doit être injecté, pas instancié à la main |
| Expert SQL | ✅ | Sans objet |
| Ingénieur QA | ⚠️ | Tester : hors ligne, coupure en cours d'envoi, quota plein, jeton expiré |
| Expert sécurité | ❌ **bloquant** | Rien ne part sur le réseau tant que **B-101** n'est pas fait. Jeton OAuth en Keystore. Mot de passe de sauvegarde **jamais** transmis |
| Ingénieur DevOps | ⚠️ | Clés d'API hors du dépôt (`local.properties` + `BuildConfig`), R8 obligatoire |
| Relecteur | ✅ | Sous réserve d'une interface propre |

**Un ❌ bloquant (sécurité)** → l'ordre B-101 avant B-112 n'est pas négociable.

---

## 6. Recommandation

**Google Drive avec la portée `drive.appdata`**, pour une raison décisive sur le
marché cible : **le compte Google est déjà configuré sur l'appareil**. Zéro
friction d'adoption, là où Dropbox impose une installation et une création de
compte à un commerçant qui n'en a pas l'usage par ailleurs.

Le risque « pas de GMS » est **déjà assumé** par le projet (ML Kit en dépend).
Mitigation : conserver l'export manuel SAF comme voie de secours universelle.

### Architecture proposée

```kotlin
interface RemoteBackupStorage {                    // substituable
    suspend fun upload(archive: File, name: String): Result<String>
    suspend fun list(): Result<List<RemoteBackup>>
    suspend fun download(id: String, dest: File): Result<Unit>
    suspend fun isAuthenticated(): Boolean
}

class GoogleDriveBackupStorage(...) : RemoteBackupStorage   // implémentation 1
// DropboxBackupStorage : possible plus tard sans rien changer ailleurs
```

Chaîne complète :
```
BackupWorker
  └─ BackupManager.exportBackupWithPassword(...)   ← archive chiffrée (B-101)
       └─ RemoteBackupStorage.upload(...)          ← contrainte réseau RÉELLE
            └─ rotation : conserver les N dernières
```

### Plan d'exécution

| # | Étape | Réf. | Jalon |
|---|---|---|---|
| 1 | Renommage honnête des libellés | B-110 | **J0** |
| 2 | Brancher `BackupManager` sur sauvegarde/restauration locale | B-101 | J1 |
| 3 | Checkpoint WAL avant copie | B-013 | J1 |
| 4 | Retirer la contrainte réseau inutile de `BackupWorker` | B-014 | J1 |
| 5 | Interface `RemoteBackupStorage` + implémentation Drive | B-112 | J6 |
| 6 | Écran de configuration + état de dernière sauvegarde | B-112 | J6 |
| 7 | Export manuel SAF en voie de secours | B-112 | J6 |

**Le mot de passe de sauvegarde n'est jamais transmis ni stocké.** Corollaire
assumé : un utilisateur qui l'oublie perd l'accès à ses archives. À afficher
explicitement dans l'UI.

---

## 7. Décisions requises

- [ ] **A** — Google Drive confirmé, ou préférence pour Dropbox ?
- [ ] **B** — B-110 : renommer les libellés seuls, ou aussi les identifiants
      (`syncToCloud` → `exportAndShare`) ?
- [ ] **C** — Mot de passe de sauvegarde : saisi à chaque export, ou dérivé du
      `managerCode` (plus simple pour l'utilisateur, mais couple sauvegarde et
      accès applicatif) ?
