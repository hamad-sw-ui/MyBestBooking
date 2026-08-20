# 🔐 SÉCURITÉ

État au 2026-07-28, **révision 2** après confirmation des correctifs de
sécurité antérieurs (audit GitHub Copilot + Gemini Code Assist).

## 0. Correctifs de sécurité déjà en place (vérifiés dans le code)

| # | Correctif | Vérification | Statut |
|---|---|---|---|
| 1 | Porte dérobée `MASTER_EMERGENCY_2024` supprimée | 0 occurrence dans tout le dépôt | ✅ |
| 2 | `fallbackToDestructiveMigration()` retiré | 0 occurrence | ✅ **à ne jamais réintroduire** |
| 3 | Clé DB dérivée (`phone`+`managerCode`) + AndroidKeyStore + rekey auto/manuel, mode standard SQLCipher | `SecurityUtil`, `AppDatabase` ; 0 occurrence de syntaxe hex brute `x'...'` | ✅ |
| 4 | Sauvegarde chiffrée par mot de passe (PBKDF2 100k + AES-GCM + checksum) | `BackupManager` complet | ⚠️ **code présent mais non branché** → BUG-017 |
| 5 | PIN en PBKDF2 + sel unique + migration paresseuse | `SecurityUtil.hashPinPbkdf2`/`verifyPin`, `MainViewModel.checkPin` | ✅ |

Couverts par `SecurityMigrationTest` (2 tests d'instrumentation passants).

**Ces acquis ne doivent pas être régressés.** Toute modification touchant
`SecurityUtil`, `AppDatabase` ou `BackupManager` doit vérifier explicitement que
ces cinq points restent satisfaits.

---

---

## 1. Actifs à protéger

| Actif | Sensibilité | Où |
|---|---|---|
| Historique des ventes et de la caisse | 🔴 Élevée — donnée financière irremplaçable | `caisse_database` (SQLCipher) |
| Dettes et coordonnées clients | 🔴 Élevée — donnée personnelle | tables `customers`, `ventes` |
| PIN Manager / Staff | 🔴 Élevée — contrôle d'accès | `boutique`, `staff` (hachés) |
| `managerCode` | 🔴 Critique — **dérive la clé de chiffrement** | `boutique.managerCode` |
| Clé SQLCipher | 🔴 Critique | AndroidKeyStore + SharedPreferences chiffrées |
| Secret de licence | 🟠 Moyenne — protège le revenu | **en clair dans le code** |
| Contenu des SMS | 🟠 Moyenne | `ventes.smsBody`, `sms_errors.body` |
| Fichiers de sauvegarde | 🔴 Élevée | `filesDir`, `getExternalFilesDir()`, cache |

---

## 2. Modèle de menace

| # | Menace | Réalisme | Protection actuelle | Verdict |
|---|---|---|---|---|
| M1 | Vol du téléphone → lecture des données | Élevé | SQLCipher + Keystore | 🟠 Partiel (clé faiblement dérivée) |
| M2 | Employé malveillant modifiant les ventes | Élevé | Rôles, PIN, `action_logs`, verrouillage après clôture | 🟡 Correct |
| M3 | Employé falsifiant l'heure système | Moyen | `AnomalyEngine` + contrôle SMS | 🔴 Contrôle SMS inopérant (BUG-008) |
| M4 | Contournement de la licence | Élevé | HMAC local | 🔴 Trivial (secret en clair, pas de R8) |
| M5 | Autre application lisant les données | Faible | Stockage interne + chiffrement | 🟡 Correct, sauf miroir externe |
| M6 | Faux SMS MoMo pour simuler un paiement | Moyen | `isSecure` (expéditeur officiel), déduplication | 🟡 Correct mais heuristique |
| M7 | Appareil rooté | Moyen | — | 🔴 Aucune protection (assumé) |
| M8 | Perte de données par migration ratée | **Élevé** | `fallbackToDestructiveMigration` retiré ✅ | 🔴 **BUG-001/002** — divergences schéma subsistantes |
| M9 | Sauvegarde exposée en clair | Moyen | Le `.db` reste chiffré | 🟡 Correct, mais partagé sans contrôle |

---

## 3. Chiffrement de la base

```
Nominal :  SHA-256("phone|managerCode|CIPHER_SECRET_V1")  →  32 octets
Repli   :  SHA-256(ANDROID_ID + "CAISSE_CIPHER_SECRET")   →  32 octets
Stockage:  clé chiffrée AES/GCM (AndroidKeyStore, alias "db_key_enc_v1")
           puis Base64 dans SharedPreferences "security_prefs"
Passphrase SQLCipher = hexadécimal de la clé (PBKDF2 appliqué par SQLCipher)
```

**Acquis (correctif n°3, vérifié)** :
- ✅ Plus aucun secret en dur dans la dérivation : la clé dépend du `managerCode`.
- ✅ Clé protégée par AndroidKeyStore (AES/GCM).
- ✅ Rekey automatique et manuel opérationnels, testés en instrumentation.
- ✅ **Mode standard** : SQLCipher applique son PBKDF2 natif sur la passphrase
  hexadécimale ; aucune manipulation de syntaxe SQL brute `x'...'`.

**Faiblesses résiduelles** :
- 🟡 **Une seule itération de SHA-256** au niveau applicatif, sans sel aléatoire.
  Atténué par le PBKDF2 natif de SQLCipher en aval et par l'exigence d'un
  `managerCode` ≥ 12 caractères. *(BUG-004 — requalifié 🟡, non prioritaire)*
- 🟡 Le repli sur `ANDROID_ID` n'est pas un secret ; il ne subsiste que comme
  voie de migration à sens unique, à retirer une fois la migration généralisée.
- 🟠 `PRAGMA rekey` construit par concaténation de chaîne *(BUG-006 / B-025)*.
- 🟡 Le Keystore n'exige pas l'authentification utilisateur
  (`setUserAuthenticationRequired(false)` implicite) — choix délibéré : l'app
  doit fonctionner sans verrouillage d'écran configuré.

---

## 4. Authentification (PIN)

- PBKDF2WithHmacSHA256, **5 000 itérations**, sel Base64 de 16 octets, sortie 256 bits.
- Comparaison à temps constant (`MessageDigest.isEqual`) ✅.
- Migration paresseuse depuis le SHA-256 legacy sans sel ✅.
- Verrouillage temporaire après échecs (`PreferencesManager.lock`) ✅.

**Acquis (correctif n°5, vérifié)** : passage de SHA-256 nu à PBKDF2 + sel
unique par utilisateur, avec migration paresseuse au login. ✅

**Faiblesses résiduelles** :
- 🟠 **5 000 itérations, c'est trop peu** en 2026 (recommandation OWASP :
  ≥ 600 000 pour PBKDF2-HMAC-SHA256). À noter : `BackupManager` utilise déjà
  **100 000** itérations — l'incohérence entre les deux modules est en soi un
  signal. *(B-028)*
- 🟠 PIN à 4 chiffres = 10 000 combinaisons → seul le verrouillage protège du
  brute force. Vérifier qu'il n'est pas contournable par redémarrage.
- 🟡 Le hash SHA-256 legacy (sans sel) subsiste tant que la migration paresseuse
  n'a pas eu lieu.

---

## 5. Licence

⚠️ **À distinguer du correctif n°1** : la porte dérobée `MASTER_EMERGENCY_2024`
est bien supprimée ✅. Le problème ci-dessous est **distinct** et non couvert par
l'audit antérieur — il porte sur le sel du HMAC de licence.

🔴 **Contournable trivialement** :
- `SECRET_SALT` en clair dans `LicenseUtil` ;
- `generateActivationKey()` (outil admin) **présent dans l'APK client** ;
- `isMinifyEnabled = false` → décompilation directe.

Correctifs : B-022 (R8), B-023 (retirer le générateur), B-024 (sortir le secret).
La protection restera imparfaite : voir `KNOWN_LIMITATIONS.md` §2.

---

## 6. Permissions — surface d'attaque

`READ_SMS` et `RECEIVE_SMS` sont des permissions **sensibles** : elles donnent
accès à l'intégralité des SMS (codes bancaires, OTP…).

Obligations :
- Déclaration d'usage argumentée sur le Play Store (sous peine de rejet).
- **Ne jamais** exfiltrer un SMS hors de l'appareil.
- `ventes.smsBody` conserve le texte brut → à purger avec `purgeOldData`.

`SmsReceiver` est exporté mais protégé par `android:permission="android.permission.BROADCAST_SMS"` ✅.

---

## 7. Sauvegardes

> ⚠️ **BUG-017** : `BackupManager` (PBKDF2 100k + AES-GCM + checksum, correctif
> n°4) est implémenté mais **n'est appelé par aucun code applicatif**. Les
> chemins réellement utilisés sont les copies brutes ci-dessous. Le fichier
> copié reste chiffré par SQLCipher, mais sans mot de passe utilisateur ni
> contrôle d'intégrité.

- `filesDir/daily_backup.db` — stockage interne ✅
- `getExternalFilesDir()/caisse_mirror.db` — stockage externe privé à l'app
  🟡 (accessible en ADB ou sur appareil rooté ; le fichier reste chiffré)
- `syncToCloud` — copie dans `cacheDir` puis `ACTION_SEND` : le fichier part vers
  une destination **choisie par l'utilisateur** (Gmail, WhatsApp, Drive…).
  🟡 Il reste chiffré, mais la clé dépend du `managerCode` : le destinataire ne
  peut rien en faire sans ce code. Cette propriété est **essentielle** et doit
  être préservée lors du renforcement de la dérivation (B-021).
- ⚠️ `android:allowBackup="true"` dans le manifeste avec `backup_rules.xml` :
  **à auditer** — la base chiffrée ne doit pas remonter dans une sauvegarde
  Google sans la clé Keystore correspondante (qui, elle, n'est pas exportable).

---

## 8. Journalisation

`action_logs` trace : ajustements de stock, changements de prix, suppressions de
vente, clôtures, sauvegardes, anomalies. Niveaux INFO / WARNING / CRITICAL,
avec `userRole` ✅.

**Faiblesses** :
- 🟡 Le journal est modifiable par quiconque a accès à la base (pas de chaînage
  cryptographique) — un manager peut effacer ses traces.
- 🟡 Aucun contrôle : le log est purgé par `purgeOldData`.

---

## 9. Règles de sécurité permanentes

1. **Aucun secret en clair** dans le code source (clé, sel, numéro privé, token).
2. **Aucune donnée personnelle** hors de l'appareil sans action explicite de l'utilisateur.
3. **Aucun SQL construit par concaténation.**
4. Toute modification touchant `SecurityUtil`, `AppDatabase` ou la sauvegarde
   exige un `REPORTS/rapport_securite_<date>.md`.
5. Toute nouvelle permission doit être justifiée par écrit ici.
6. Les hachages de PIN et la dérivation de clé ne changent **jamais** sans
   chemin de migration testé.
7. R8 activé en release, sans exception.
8. Ne jamais logger un PIN, une clé, un `managerCode` ou un SMS complet.

---

## 10. Suivi

| Réf. | Sujet | Priorité |
|---|---|---|
| B-020/021 | Dérivation de clé : sel aléatoire (optionnel) | 🟡 *(requalifié)* |
| **B-101** | **Brancher `BackupManager` sur le parcours de sauvegarde** | 🟠 *(nouveau)* |
| B-022 | R8 | 🟠 |
| B-023/024 | Secret de licence | 🟠 |
| B-025 | `PRAGMA rekey` | 🟠 |
| B-028 | Itérations PBKDF2 du PIN | 🟠 |
| B-029 | Anomalie de date SMS | 🟡 |
| B-026 | Seeder en debug uniquement | 🟡 |
| B-027 | Rôle porté par `Screen` | 🟡 |
| — | Audit de `allowBackup` | 🟡 |
