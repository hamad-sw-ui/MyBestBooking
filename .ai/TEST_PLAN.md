# 🧪 PLAN DE TESTS — MyBestBooking

> Le corpus Android historique est conserve dans les sections archivees. Les
> validations normatives de MyBestBooking sont celles decrites ci-dessous.

## Validation actuelle

| Controle | Commande | Dernier resultat |
|---|---|---|
| Types | `npx tsc --noEmit` | ✅ OK le 2026-08-23 |
| Build | `npm run build` | ✅ OK le 2026-08-23 |
| Lint cible | `npx eslint ...` | ✅ 0 erreur |
| Authentification | `npx vitest run src/lib/auth.test.ts` | ✅ 10/10 |
| Smoke navigateur | `npx playwright test tests/e2e/smoke.spec.ts --workers=1` | ✅ 6/6 |
| Santé API | `GET /api/health` | ✅ `{"ok":true}` quand DB disponible |

## Parcours à couvrir ensuite

- Recherche avec prix, dates, chambre indisponible et pagination multi-pages.
- Connexion avec et sans TOTP, `rememberMe` et expiration de session.
- Réservation invitée avec email nouveau puis email déjà lié à un compte.
- Ajout favori, doublon, création automatique de liste et suppression.
- Avis sur réservation terminée, avis dupliqué, réservation non propriétaire.
- Actions dashboard sur mobile, bulk et permissions admin/hôte.
- Analytics avec annulation, remboursement, plusieurs chambres et quantités.

## Commandes officielles

```powershell
Set-Location MyBestBooking
npm run typecheck
npm run lint
npm run build
npm test
npx playwright test tests/e2e/smoke.spec.ts --workers=1
```

Le test bulk admin peut nécessiter un serveur local sur `127.0.0.1:3000`.

---

## Archive Android (non normative pour MyBestBooking)

| Type | Fichier | Contenu | Valeur |
|---|---|---|---|
| Unitaire | `test/.../SecurityUtilTest.kt` | Compatibilité Base64, `verifyPin` PBKDF2 | ✅ Réel |
| Unitaire | `test/.../ExampleUnitTest.kt` | `assertEquals(4, 2+2)` généré | ❌ À supprimer |
| Instrumenté | `androidTest/.../SecurityMigrationTest.kt` | Migration de clé / rekey SQLCipher | ✅ Réel |
| Instrumenté | `androidTest/.../ExampleInstrumentedTest.kt` | Vérifie le nom du package | ❌ À supprimer |

**Couverture métier estimée : ~0 %.**
Zéro test sur `SmsParser`, `FeeCalculator`, `LicenseUtil`, `AnomalyEngine`,
`MainRepository`, les migrations Room et l'UI.

⚠️ **Les tests ne peuvent pas être exécutés dans l'environnement de l'agent**
(ni JDK ni SDK Android). Leur exécution incombe au responsable ou à la CI (B-098).

---

## 2. Priorisation par le risque

Critère : *quelle défaillance coûte le plus cher au commerçant ?*

| Rang | Zone | Risque si défaillant | Testabilité | Priorité |
|---|---|---|---|---|
| 1 | Migrations Room | **Perte totale des données** | Bonne (`MigrationTestHelper`) | 🔴 |
| 2 | `SmsParser` | Ventes fantômes ou paiements manqués | **Excellente** (objet pur) | 🔴 |
| 3 | Ventes en transaction | Stock ou caisse incohérents | Bonne (Room in-memory) | 🔴 |
| 4 | `FeeCalculator` | Montants faux | **Excellente** (fonction pure) | 🟠 |
| 5 | `SecurityUtil` | Base illisible / accès non autorisé | Bonne | 🟠 (partiellement couvert) |
| 6 | `LicenseUtil` | Perte de revenu / blocage client légitime | Excellente | 🟠 |
| 7 | Clôture & sessions | Écarts de caisse erronés | Moyenne | 🟠 |
| 8 | `AnomalyEngine` | Fraude non détectée | Excellente | 🟡 |
| 9 | Sauvegarde/restauration | Sauvegarde inexploitable | Moyenne (instrumenté) | 🟠 |
| 10 | Écrans Compose | Gêne d'usage | Coûteuse | 🟡 |

---

## 3. Tests unitaires à écrire (JVM, `src/test`)

### 3.1 `SmsParser` — B-090 🔴
- SMS MTN MoMo réel → montant, ID, expéditeur, `type = MOMO_MTN`, `isSecure = true`
- SMS Orange Money réel → `type = MOMO_ORANGE`
- SMS de confirmation d'abonnement (`692971991`) → `SUB_CONFIRMATION`
- SMS publicitaire contenant « FCFA » → `null` (score < 50)
- SMS d'un numéro long non officiel → `isSecure = false`
- SMS sans ID de transaction → `null`
- SMS sans montant → `null`
- Montant avec séparateurs (`5.000 FCFA`, `5,000 FCFA`)
- Accents et casse mélangés
- Numéro à préfixe `237`
- Faux positif : l'ID de transaction ne doit pas capter le numéro de téléphone
- Format inconnu → `null` (jamais d'exception)

### 3.2 `FeeCalculator` — B-091 🟠
- MTN retrait / transfert / paiement marchand
- Orange retrait / transfert / paiement marchand
- Opérateur inconnu → `0.0`
- Montant nul ou négatif → `0.0`
- Cohérence avec `calculateMomoFees` (avant sa suppression)

### 3.3 `LicenseUtil` — B-092 🟠
- Clé générée par `generateActivationKey` → validée par `verifyKey`
- Clé valide sur un **autre** numéro → `null`
- Signature altérée d'un caractère → `null`
- Format invalide (pas de `-`, trop de segments) → `null`
- Date d'expiration correctement décodée
- Numéro sous plusieurs formes (`+237…`, `237…`, `6…`) → même résultat

### 3.4 `AnomalyEngine` — B-093 🟡
- Vente datée dans le futur → bloquée
- Deux ventes identiques à moins de 30 s → bloquée
- Montant > 500 000 → avertissement, non bloquant
- Vente normale → `OK`

### 3.5 `SecurityUtil` — complément 🟠
- `hashPinPbkdf2` déterministe à sel constant
- Sels différents → hashs différents
- `verifyPin` : PBKDF2 correct/incorrect, legacy SHA-256, `savedHash == null`
- `deriveNewKey` : déterminisme, longueur 32 octets, sensibilité au `managerCode`

### 3.6 `PhoneUtil` / `FormatUtil` 🟡
Normalisation des numéros camerounais, formatage des montants FCFA et des dates.

---

## 4. Tests instrumentés (`src/androidTest`)

### 4.1 Migrations Room — B-012 🔴 **priorité absolue**
Outil : `androidx.room:room-testing` + `MigrationTestHelper` (nécessite
`exportSchema = true`, B-009).

- Chaque saut `n → n+1` de 18 à 29
- Migration complète 18 → 29
- **Conservation des données** : insérer des lignes en v18, vérifier leur
  intégrité en v29
- Cas de non-régression pour chacune des 6 migrations défectueuses (BUG-001)

### 4.2 Repository sur base en mémoire — B-094 🔴
`Room.inMemoryDatabaseBuilder` (sans SQLCipher).

- `addVenteWithItems` : vente + items créés, stock décrémenté, mouvements écrits,
  numéro de facture séquentiel correct
- Vente d'un produit composé → déduction des ingrédients via `recipes`
- Vente à crédit → `customers.totalDebt` augmenté
- `allowNegativeStock = false` → vente refusée si stock insuffisant
- `returnVenteItem` → stock réintégré, avoir crédité
- `cancelVente` / `deleteVente` → effets inverses complets
- `performClosure` → ventes du jour verrouillées (`isLocked = true`)
- Rollback : une exception en milieu de transaction ne laisse **aucune** écriture partielle
- Déduplication SMS : deux fois le même `transactionId` → une seule vente

### 4.3 Sauvegarde / restauration 🟠
Sauvegarde puis restauration → données identiques ; intégrité avec WAL actif (BUG-011).

### 4.4 UI Compose — B-095 🟡
Parcours critiques uniquement :
- Nouvelle vente : ajout au panier → validation → confirmation
- Saisie du PIN : correct → accès ; incorrect → refus + verrouillage
- Clôture de journée : saisie des montants réels → écart affiché

---

## 5. Dépendances de test à ajouter

```toml
kotlinx-coroutines-test  # runTest, TestDispatcher
androidx-room-testing    # MigrationTestHelper
turbine                  # test de Flow
mockk                    # doublures
androidx-arch-core-testing
```
→ Tâche B-090 (jalon 3).

---

## 6. Conventions

- Nommage : back-ticks descriptifs, en français
  `` fun `une vente à crédit augmente la dette du client`() ``
- Structure **Arrange / Act / Assert** explicite.
- Un test = une assertion logique.
- Aucun test dépendant de l'horloge réelle : injecter une horloge.
- Aucun test dépendant du réseau (il n'y en a pas) ni de l'ordre d'exécution.
- Les tests de migration utilisent des **schémas figés**, jamais les entités courantes.

---

## 7. Objectifs de couverture

| Périmètre | Cible | Actuel |
|---|---|---|
| `utils/` (fonctions pures) | **90 %** | ~15 % |
| `sms/SmsParser` | **95 %** | 0 % |
| `data/repository` | **70 %** | 0 % |
| Migrations Room | **100 %** des sauts | 0 % |
| `ui/` | parcours critiques | 0 % |

Mesure via JaCoCo (B-099), rapport dans `REPORTS/rapport_couverture_<date>.md`.

---

## 8. Commandes

```bash
./gradlew test                       # tests unitaires JVM
./gradlew connectedAndroidTest       # tests instrumentés (appareil requis)
./gradlew lint                       # analyse statique Android
./gradlew testDebugUnitTest --tests "*SmsParser*"
```

⚠️ Aucune de ces commandes n'est exécutable dans l'environnement de l'agent.
