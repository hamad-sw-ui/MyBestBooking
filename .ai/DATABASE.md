# 🗄️ BASE DE DONNÉES — ARCHIVE HISTORIQUE

> ⚠️ Ce document décrit Room/SQLCipher et ne s'applique pas à MyBestBooking.
> Le schéma actuel est dans `src/db/schema.ts` et est décrit dans `PROJECT.md`.

## État Next.js / PostgreSQL (normatif)

- Schéma Drizzle : `src/db/schema.ts`; migrations SQL additives `0000` à
  `0013_orchestration-resilience.sql`.
- T-107 ajoute `bookings.benefits_released_at`,
  `email_outbox.provider_message_id` et remplace les FK `review_votes` par
  `ON DELETE CASCADE`. La migration ne réécrit aucune réservation historique.
- Les bookings sont le journal du hold paiement : `payment_expires_at`, intent,
  remboursement et libération d’avantages restent persistés/rejouables.
- Toute migration future doit rester additive, être appliquée sur une chaîne
  fraîche et vérifier les contraintes/FK avec PostgreSQL réel.


| Élément | Valeur |
|---|---|
| Moteur | **Room 2.7.0-alpha12** (KSP) sur **SQLCipher 4.5.4** |
| Nom du fichier | `caisse_database` (`context.getDatabasePath`) |
| Version du schéma | **28** |
| `exportSchema` | ⚠️ **false** — aucun schéma JSON versionné en Git |
| Journal mode | `WRITE_AHEAD_LOGGING` |
| TypeConverters | `Converters` : `Date` ⇄ `Long` |
| Migrations fournies | 18→19 … 27→28 (10 migrations) |
| Stratégie de repli | ✅ `fallbackToDestructiveMigration` **volontairement absent** (correctif de sécurité validé — ne pas réintroduire) |

---

## 0. Acquis de sécurité à ne pas régresser (vérifié 2026-07-28)

- ✅ `fallbackToDestructiveMigration()` **retiré volontairement** — ne jamais le
  réintroduire, même « temporairement » pour faire taire un crash de migration.
- ✅ Clé dérivée de `phone + managerCode`, protégée par AndroidKeyStore.
- ✅ Rekey automatique (`performRekeyIfNecessary`) et manuel (`forceRekey`),
  couverts par `SecurityMigrationTest` (2 tests d'instrumentation passants).
- ✅ **Mode standard SQLCipher** : passphrase hexadécimale confiée à SQLCipher
  qui applique son PBKDF2 natif. Aucune syntaxe brute `x'...'` dans le code
  applicatif — **ne pas y revenir**.

---

## 1. Chiffrement

```
managerCode (≥12 alphanum) + phoneNumber
        │
        ├─ SHA-256("phone|managerCode|CIPHER_SECRET_V1")  ⚠️ 1 seule itération
        ▼
    clé 32 octets
        │
        ├─ chiffrée AES/GCM par une clé AndroidKeyStore (alias "db_key_enc_v1")
        │  et stockée en Base64 dans SharedPreferences "security_prefs"
        ▼
    passphrase SQLCipher = représentation hexadécimale de la clé
```

- **Repli legacy** : `getDatabaseKeyCompat()` dérive la clé de `ANDROID_ID`
  (⚠️ pas un secret — voir `SECURITY.md`).
- **Rekey automatique** : `performRekeyIfNecessary()` s'exécute à l'ouverture ;
  si aucune clé Keystore n'existe mais que la boutique a un `managerCode` valide,
  la base est ré-encryptée via `PRAGMA rekey`.
- **Rekey manuel** : `forceRekey(context, phone, newManagerCode)` (changement de
  code manager depuis les Paramètres).
- ⚠️ `PRAGMA rekey = '$newKeyPassphrase'` est construit par concaténation de
  chaîne (BUG-006).

---

## 2. Entités (22)

| Table | Entité | Clé | Champs notables |
|---|---|---|---|
| `boutique` | `BoutiqueEntity` | `id: Int = 1` (ligne unique) | `pinHash/pinSalt`, `managerPinHash/managerPinSalt`, `managerCode`, `taxRate`, options de ticket, `printerAddress`, `hideProfitsFromStaff` |
| `ventes` | `VenteEntity` | auto | `amount`, `paymentMethod` (CASH/MOMO/CREDIT), `status` (PENDING/CONFIRMED/FAILED/CREDIT), `reconciliationStatus` (PENDING/OK/DISCREPANCY/ORPHAN), `transactionId`, `amountCash`/`amountMomo`, `fees`, `discount`, `taxAmount`, `isLocked`, `sessionId`, `invoiceNumber` |
| `vente_items` | `VenteItemEntity` | auto | FK `venteId` → `ventes` CASCADE ; `purchasePrice` figé à la vente ⚠️ **pas d'index sur `venteId`** |
| `stock` | `StockEntity` | auto | index **unique** sur `barcode` ; `isBulk`, `retailUnit`, `conversionFactor`, `retailPrice`, `vipPrice`, `alertThreshold` ; `Serializable` |
| `stock_movements` | `StockMovementEntity` | auto | `type` (IN/OUT/LOSS/AUDIT), `balanceAfter` |
| `price_history` | `PriceHistoryEntity` | auto | `oldPrice`/`newPrice`, `type` (PURCHASE/SALE) |
| `recipes` | `RecipeEntity` | auto | 2 FK vers `stock` CASCADE (`parentProductId`, `ingredientProductId`), indexées |
| `categories` | `CategoryEntity` | auto | `name`, `type` (PRODUCT/EXPENSE) |
| `customers` | `CustomerEntity` | auto | `totalDebt`, `creditBalance` (avoirs), `isVip`, `loyaltyPoints`, `totalSpent` |
| `repayments` | `RepaymentEntity` | auto | `customerId`, `paymentMethod` |
| `expenses` | `ExpenseEntity` | auto | `label`, `category` |
| `suppliers` | `SupplierEntity` | auto | `phone`, `address`, `totalDebt` |
| `supplies` | `SupplyEntity` | auto | `isPaid`, `expiryDate`, `supplierId` |
| `sessions` | `SessionEntity` | auto | `sellerName`, `openingBalance`, `closingBalance`, `expectedBalance`, totaux, `isActive` |
| `closures` | `ClosureEntity` | auto | théorique vs réel espèces/MoMo, `discrepancy` |
| `audits` | `AuditEntity` | auto | `totalDiscrepancy` |
| `audit_items` | `AuditItemEntity` | auto | `auditId` (⚠️ **pas de FK, pas d'index**), `systemQuantity` vs `physicalQuantity` |
| `staff` | `StaffEntity` | auto | `pinHash`/`pinSalt`, `role` (STAFF/MANAGER), `isActive` |
| `action_logs` | `ActionLogEntity` | auto | `actionType`, `severity` (INFO/WARNING/CRITICAL), `userRole` |
| `sms_errors` | `SmsErrorEntity` | auto | `body`, `sender`, `isResolved` |
| `processed_sms` | `ProcessedSmsEntity` | `transactionId: String` | déduplication SMS |
| `subscription` | `SubscriptionEntity` | `id: Int = 1` | `startDate`/`endDate`, `deviceId`, `activationKey` |

---

## 3. DAO (20)

`ActionLogDao`, `AuditDao`, `BoutiqueDao`, `CategoryDao`, `ClosureDao`,
`CustomerDao`, `ExpenseDao`, `PriceHistoryDao`, `ProcessedSmsDao`, `RecipeDao`,
`RepaymentDao`, `SessionDao`, `SmsErrorDao`, `StaffDao`, `StockDao`,
`StockMovementDao`, `SubscriptionDao`, `SupplierDao`, `SupplyDao`, `VenteDao`.

Conventions observées :
- Lecture réactive → `fun x(): Flow<List<T>>`
- Lecture ponctuelle → `suspend fun xOnce(): T?`
- Écriture → `suspend fun` avec `@Insert(onConflict = REPLACE)` / `@Update` / `@Delete`
- Relations → `@Transaction` + `@Relation` : `VenteWithItems` (VenteDao),
  `AuditWithItems` (AuditDao), `RecipeWithProduct` (RecipeDao)

⚠️ Code mort : `StaffDao.getStaffByPin(pinHash)` n'est plus appelé (la
vérification passe par PBKDF2 en boucle dans `MainViewModel.checkPin`).

---

## 4. 🔴 Migrations — incohérences bloquantes (BUG-001)

Room compare le schéma produit par les migrations au schéma généré depuis les
`@Entity`. **Six migrations produisent un schéma différent** → au premier
lancement après mise à jour, Room lève
`IllegalStateException: Migration didn't properly handle: <table>`.

| Migration | Colonnes créées par la migration | Colonnes attendues par l'entité | Verdict |
|---|---|---|---|
| **20→21** `boutique` | `totalQuantityOnReceipt` | `showTotalQuantityOnReceipt` | ❌ nom différent |
| **21→22** `processed_sms` | ajoute `status`, `errorMessage` | entité = `transactionId`, `processedDate` | ❌ colonnes en trop |
| **22→23** `categories` | `name`, `description`, `color`, `icon` + index unique `name` | `name`, `type` | ❌ `type` absent |
| **23→24** `suppliers` | `phoneNumber`, `email`, `category`, `notes` + index unique | `phone`, `address`, `totalDebt` | ❌ divergence totale |
| **24→25** `sessions` | `staffName`, `startCash`, `expectedEndCash`, `actualEndCash`, `status`, FK staff | `sellerName`, `openingBalance`, `closingBalance`, `expectedBalance`, `totalCashSales`, `totalMomoSales`, `totalExpenses`, `isActive` | ❌ divergence totale + `staffId` NOT NULL vs nullable |
| **25→26** `staff` | `permissions`, `createdAt` NOT NULL | `phone`, `pinSalt` | ❌ divergence |
| **26→27** `processed_sms` | ajoute `type` | — | ❌ colonne en trop |

**Note** : sur une **installation neuve**, Room crée les tables depuis les
entités → l'app fonctionne. Le bug ne se manifeste que sur les appareils
possédant déjà une base ancienne. C'est précisément le scénario le plus
dangereux (données réelles).

### Trous de migration
Aucune migration en dessous de 18. Une base en version 1–17 ne peut pas migrer
et **crashe sans issue** (BUG-002).

**✅ Décision D1 (2026-07-28)** : cas assumé. Détection de la version < 18 →
écran de consentement → export de courtoisie → recréation. Perte de données
assumée dans ce cas rare, mais **jamais silencieuse**.

### 🔎 Point d'attention : conflit `staff.pinSalt`
La migration 25→26 crée `pinSalt TEXT NOT NULL`, alors que `StaffEntity` le
déclare **nullable**. Or le mécanisme de **migration paresseuse des PIN**
(`MainViewModel.checkPin`) repose précisément sur `pinSalt == null` pour
détecter un hash legacy à re-hacher. La correction de BUG-001 doit préserver
cette nullabilité.

### 💡 Contexte favorable (aucun utilisateur en production)
Aucune base réelle n'existe aujourd'hui. La chaîne de migrations peut donc être
**refondue intégralement** — par exemple en repartant d'une v1 propre générée
par Room — plutôt que rapiécée migration par migration. Option à arbitrer en
J1.3 ; c'est la plus propre et elle ne coûte rien maintenant.

### Procédure obligatoire pour toute modification de schéma

1. Passer `exportSchema = true` et versionner `app/schemas/` en Git.
2. Incrémenter `version` de `@Database`.
3. Écrire la `Migration(n, n+1)` **en copiant le SQL généré par Room**
   (`app/schemas/<version>.json`), jamais à la main de mémoire.
4. Ajouter la migration à `addMigrations(...)`.
5. Écrire un test `MigrationTestHelper` (`androidTest`) qui migre n → n+1 et
   valide les données.
6. Mettre à jour ce fichier.

---

## 5. Transactions

`MainRepository` utilise `db.withTransaction { }` pour les opérations composées.
Exemple, `addVenteWithItems` :
1. numéro de facture séquentiel `AAAA-NNNN` ;
2. rattachement à la session active ;
3. insertion vente + items ;
4. décrément du stock (avec déduction des ingrédients si recette) ;
5. écriture des `stock_movements` ;
6. mise à jour dette / points client ;
7. `AnomalyEngine.analyzeVente` ;
8. `logAction(...)`.

---

## 6. Purge et sauvegarde

- `purgeOldData(months)` — supprime ventes clôturées et logs anciens (écran Maintenance).
- `backupDatabase(context, file)` / `restoreDatabase(context, file)` — copie de fichier ;
  ⚠️ la base doit être fermée et le WAL fusionné, à vérifier (voir BUG-011).
- `BackupWorker` — quotidien : `filesDir/daily_backup.db` + `getExternalFilesDir()/caisse_mirror.db`.
- `BackupManager` — export/import JSON (`kotlinx.serialization`), usage partiel.

---

## 7. Points de vigilance permanents

- 🔴 Ne jamais modifier une `@Entity` sans migration correspondante **testée**.
- 🔴 Ne jamais changer `managerCode` sans passer par `forceRekey` (base illisible sinon).
- 🟠 Ajouter un index sur `vente_items.venteId` et `audit_items.auditId`.
- 🟠 `AuditItemEntity.auditId` devrait être une vraie `ForeignKey`.
- 🟡 `getAllVentes()` charge tout l'historique en mémoire → paginer (Paging 3).
