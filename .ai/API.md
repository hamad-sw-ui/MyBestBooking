# 🔌 API & INTERFACES EXTERNES

> **Il n'y a aucune API HTTP dans ce projet.** Pas de Retrofit, Ktor, OkHttp,
> Firebase ni backend. L'application est **100 % hors-ligne**.
> Ce document recense les **interfaces externes réelles** : SMS, Bluetooth,
> Intents système, caméra, licence.

---

## 1. SMS Mobile Money — l'interface la plus critique

### Entrée temps réel

`SmsReceiver` (`BroadcastReceiver`, exporté, `android.permission.BROADCAST_SMS`,
priorité 999) écoute :
- `android.provider.Telephony.SMS_RECEIVED`
- `android.intent.action.BOOT_COMPLETED` / `QUICKBOOT_POWERON`

### Contrat de parsing — `SmsParser.parse(body, originatingAddress): ParsedSms?`

```kotlin
data class ParsedSms(
    val amount: Double,
    val transactionId: String,
    val sender: String,        // n° camerounais 9 chiffres
    val type: String,          // MOMO_MTN | MOMO_ORANGE | SUB_CONFIRMATION
    val receiver: String? = null,
    val isSecure: Boolean = false   // expéditeur officiel reconnu
)
```

**Algorithme (scoring, seuil = 50)** :

| Signal | Points |
|---|---|
| Expéditeur officiel (`mobilemoney`, `mtnmomo`, `orangemoney`, `om`, `6700`, `momo`, ou adresse ≤ 6 caractères) | +40 |
| Chaque mot-clé de succès (`recu`, `reçu`, `succes`, `confirme`, `effectue`, `valide`…) | +15 |
| Chaque indicateur de devise (`fcfa`, `fcf`, `xaf`, ` f`) | +10 |

Puis extraction chirurgicale :
- **Montant** : `(\d{2,})\s*(?:fcfa|fcf|xaf|f)\b`, repli `(?:montant|somme|valeur)[:\s]*(\d{2,})`
- **ID transaction** : `(?:id|ref|transaction|no|n°|reference)[:\s]*([a-z0-9]{8,})`, repli = premier mot ≥ 10 caractères non téléphone
- **Numéro** : `(?:de|from|par|sender)[:\s]*(?:237)?(6[25-9]\d{7})`, repli = première séquence `6[25-9]\d{7}`
- **Type** : `SUB_CONFIRMATION` si le corps contient `692971991` ou `reconciliation`, sinon MTN / Orange par mots-clés

**Rejet** si `amount <= 0` ou `transactionId` vide.

⚠️ Aucun test unitaire sur ce parser alors qu'il pilote la création
automatique de ventes. Priorité de test n°1 (voir `TEST_PLAN.md`).

### Traitement aval (`SmsReceiver.processSms`)

1. Ne traite que `parsed.isSecure && transactionId.isNotBlank()`.
2. Contrôle d'anomalie de date (écart > 30 min → `logAction("DATE_ANOMALY", CRITICAL)`).
   ⚠️ Comparaison actuellement inopérante : `networkTime` et `systemTime` valent
   tous deux `System.currentTimeMillis()` (BUG-008).
3. Déduplication : `processed_sms` + recherche par `transactionId` dans `ventes`.
4. `SUB_CONFIRMATION` → `processSubscriptionSms` (activation d'abonnement).
5. Sinon : rapprochement avec une vente `PENDING` de même montant, ou création
   d'une vente « orphan », ou insertion dans `sms_errors`.
6. Notification via `notification/NotificationHelper`.

### Rattrapage — `SmsSyncManager.catchUp(context)`

Lit le `ContentProvider` SMS (`content://sms/inbox`) depuis
`PreferencesManager.getLastSmsSyncTime()` et rejoue `processSms`.
Déclenché par `MainViewModel.catchUpSms()` au démarrage.

---

## 2. Impression ESC/POS (Bluetooth)

`printing/EscPosPrinter(context)` :
- `BluetoothAdapter` → `BluetoothDevice` par adresse MAC
  (`boutique.printerAddress`), UUID SPP standard `00001101-...`.
- Ouvre un `BluetoothSocket`, envoie des commandes ESC/POS brutes
  (init, alignement, gras, coupe papier).
- Appelé par `MainRepository.printTicket(venteId, address)` et `testPrint(address)`.
- Contenu du ticket piloté par `boutique` : `receiptFooter`, `showTaxesOnReceipt`,
  `showCustomerPhoneOnReceipt`, `showTotalQuantityOnReceipt`, `printMerchantCopy`.

Permissions : `BLUETOOTH`/`BLUETOOTH_ADMIN` (≤ API 30),
`BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN` (API 31+).

---

## 3. Scanner de code-barres

`ui/scanner/BarcodeScanner.kt` — CameraX (`camera-core`, `camera2`,
`lifecycle`, `view` 1.4.0) + ML Kit (`play-services-mlkit-barcode-scanning:18.3.1`).
Résultat injecté dans la route `stock?barcode=<valeur>`.
Permission `CAMERA`. ⚠️ ML Kit via Play Services : indisponible sur les appareils
sans GMS (voir `KNOWN_LIMITATIONS.md`).

---

## 4. Intents système sortants

| Usage | Intent | Déclenché par |
|---|---|---|
| « Sync cloud » | `ACTION_SEND` du fichier `.db` via `FileProvider` | `MainRepository.syncToCloud` |
| Export CSV / PDF | `ACTION_SEND` avec URI `FileProvider` | `ExportUtil.shareFile` |
| Relance de dette | `ACTION_SENDTO` `smsto:` prérempli | `MainRepository.sendDebtReminder` |
| Paiement abonnement | code USSD MTN/Orange (`ACTION_DIAL`) | `MainRepository.getPaymentUssd(operator, amount)` |

`FileProvider` : autorité `${applicationId}.fileprovider`, chemins dans
`res/xml/file_paths.xml`.

---

## 5. Licence / abonnement (protocole hors-ligne)

`utils/LicenseUtil` :

```
clé = SIGNATURE(8 car.) + "-" + EXPIRY(DDMMYY)
SIGNATURE = base32-custom( HmacSHA256( "phone|DDMMYY|SECRET_SALT", SECRET_SALT ) )[0..7]
alphabet  = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"   (sans 0/1/I/O)
```

- `verifyKey(phone, key): Date?` — recalcule la signature, retourne la date d'expiration.
- `generateActivationKey(phone, months)` — **outil admin embarqué dans l'APK**.
- Le numéro est normalisé par `PhoneUtil.normalize`.
- Activation possible par saisie manuelle ou automatiquement via un SMS
  `SUB_CONFIRMATION` provenant du numéro développeur `692971991`.

🔴 `SECRET_SALT` est **en clair dans le code** et `isMinifyEnabled = false`
→ licence contournable (voir `SECURITY.md`, BUG-005).

---

## 6. WorkManager

| Worker | Périodicité | Contraintes | Rôle |
|---|---|---|---|
| `BackupWorker` (`"DailyBackup"`) | 24 h, `KEEP` | `NetworkType.CONNECTED` ⚠️ inutile (aucun upload) | Sauvegarde locale + miroir externe |
| `SubscriptionWorker` (`"SubscriptionCheck"`) | 24 h, `KEEP` | aucune | Notifications J-7 / J-3 / J-1 / J-0 |

Planifiés dans `MainActivity.onCreate` ⚠️ (à déplacer dans `Application` /
`Configuration.Provider` lors du passage à Hilt).

---

## 7. Permissions déclarées

`RECEIVE_SMS`, `READ_SMS`, `VIBRATE`, `CAMERA`, `BLUETOOTH`, `BLUETOOTH_ADMIN`,
`BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`.

Demandées en bloc dans `MainActivity.checkAppPermissions()` (requestCode 101),
⚠️ sans traitement du résultat ni explication pédagogique (BUG-010).

---

## 8. Si une API HTTP est ajoutée un jour

Contraintes à respecter (marché cible) :
- **Offline-first obligatoire** : la base locale reste la source de vérité.
- File d'attente de synchronisation persistée + `WorkManager` avec backoff.
- Idempotence par `transactionId` / `invoiceNumber`.
- Aucun secret en dur ; certificat pinné ; timeouts courts (réseau instable).
- Documenter ici **avant** d'écrire la moindre ligne de code réseau.
