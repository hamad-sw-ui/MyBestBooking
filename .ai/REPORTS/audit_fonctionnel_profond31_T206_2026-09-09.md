# Audit fonctionnel profond n°31 — T-206 — MyBestBooking

**Date** : 2026-09-09 · **Branche** : `arena/01a08747-mybestbooking` · **Objet** : analyse profonde runtime/fonctionnelle post T-205 des pages, boutons, API et parcours encore inachevés ou mal pensés.  
**Statut** : analyse terminée, **aucun correctif de code T-206 appliqué** dans ce rapport. Les diffs T-205 existants sont préservés.

---

## 1. Méthode et preuves exécutées

### 1.1 Validations globales

- 🔨 `npm run build` : **OK** — Next.js 16.2.6, 65 pages/routes générées.
- ▶️ `npm run site:audit -- http://127.0.0.1:3000` : **OK**, 242 pages visitées, 0 issue.
  - `anon/fr` 23 pages
  - `admin/fr` 75 pages
  - `host/fr` 98 pages
  - `customer/fr` 23 pages
  - `anon/en` 23 pages
- ▶️ `python3 scripts/run_all_sims.py` : **KO global** mais instructif :
  - smoke : 95 OK
  - surface : 67 PASS / 1 KO
  - deep : 76 OK / 2 WARN / 1 KO
  - xtreme : 83 OK / 3 WARN / 0 KO
  - paranoid : 71 OK / 0 WARN / 0 KO
  - total : 392 OK / 5 WARN / 2 KO

### 1.2 Interprétation des KO de simulation

- **Surface KO** : `POST /api/bookings` répond bien **201**, mais la simulation attend `status="confirmed"` alors que le flux T-202/T-203/T-205 a volontairement rendu la réservation manuelle **`pending`** avec confirmation hôte. C'est une attente de test obsolète, pas une régression produit.
- **Deep KO** : `/mon-compte` est vu comme incomplet parce que `scripts/deep_sim.py` ne suit pas le sibling `account-client.tsx`. Le wrapper serveur `page.tsx` importe bien le client, et `account-client.tsx` contient `TwoFactorSection`, `DeleteAccountSection`, `ReferralCard`, `NotificationPrefsSection`, `ProfileForm`, `ChangePasswordForm`.

### 1.3 Probes runtime ciblées

- ▶️ Recherche avec dates passées :
  - `GET /api/properties?checkIn=2020-01-01&checkOut=2020-01-03&guests=2` → **200**, `total=8`.
  - `/recherche?checkIn=2020-01-01&checkOut=2020-01-03&guests=2` rend **8 résultats** + bandeau d'avertissement.
- ▶️ Devis vs création booking invité avec rate plan + promo :
  - `GET /api/bookings/quote?...&ratePlanId=...` → `baseSubtotal=237.34`, `ratePlanDiscount=35.60`, `subtotal=201.74`, `taxes=20.17`, `totalBeforePromo=221.91`, `bestrewardsDiscount=0`.
  - `POST /api/bookings` invité avec `ratePlanId + promoCode=BIENVENUE10` → **201**, `status=pending`, `discount=42.16`, `total=179.75`, alors que le récap invité attendu après promo seule serait `199.72`. Données de probe nettoyées.
- ▶️ Activation directe d'un bien appartenant à un hôte `approval_status='pending'` : `PUT /api/properties/<id> {"status":"active"}` en admin → **200**, `status=active`. Données de probe nettoyées.
- ▶️ Mode maintenance : `/recherche` → **307 /maintenance**, mais `POST /api/price-alerts` en customer → **201** pendant la maintenance. Alerte de probe supprimée et `maintenanceMode=false` restauré.
- ▶️ Paramètres invalides :
  - `DELETE /api/properties/not-a-uuid` → **500**
  - `DELETE /api/rooms/not-a-uuid` → **500**
  - `GET /api/bookings?propertyId=not-a-uuid` → **500**
  - `GET /api/rooms?propertyId=not-a-uuid` → **500**
  - `GET /api/messages?conversationId=not-a-uuid` → **500**
- ▶️ Divergence moteur catalogue :
  - `GET /api/properties?amenities=tv` → `total=0`
  - `/recherche?amenity=tv` → **8 résultats**
  - `GET /api/properties?maxPrice=50000&displayCurrency=XAF` → `total=8`
  - `/recherche?maxPrice=50000&displayCurrency=XAF` → **0 résultat**
- ▶️ Clôture d'un séjour non payé : booking de probe `status=confirmed`, `payment_status=pending`, `checkOut` passé ; `PUT /api/bookings/<id> {"status":"completed"}` par l'hôte → **200**, booking `completed`, `paymentStatus=pending`, `loyaltyAwardedAt` posé. Données et compte customer restaurés.

---

## 2. Findings — problème, impact, solution sans régression

### 🔴 F1 — P1 — Calcul financier incohérent entre devis, checkout et POST booking

**Problème**  
Le tunnel invité n'applique pas de remise BestRewards dans le devis (`bestrewardsDiscount=0`), mais `POST /api/bookings` applique quand même la remise niveau 1 à un invité avant que son profil guest ne soit créé. En plus, quand un code promo est présent avec un rate plan, le champ persistant `discount` perd la remise du rate plan : `discount` est initialisé avec `ratePlanDiscount`, puis remplacé par `result.discount` lors de la promo, au lieu d'additionner.

**Impact utilisateur / métier**
- Le montant affiché au checkout invité peut être supérieur au montant réellement créé par l'API : la confirmation affiche un total inattendu.
- Les factures, dashboards et exports s'appuient sur `discount` : la ventilation des remises est fausse lorsque rate plan + promo sont combinés.
- La marge, la commission et les rapports peuvent devenir difficiles à auditer même si le `total` final est mathématiquement cohérent.

**Solution sans régression**
1. Extraire une fonction pure de calcul (`computeBookingTotals` ou équivalent) utilisée par `quote` et `POST /api/bookings`.
2. Conserver l'ordre existant validé T-205 : prix calendrier → rate plan → TVA → promo → BestRewards → wallet.
3. Corriger deux règles :
   - invité non authentifié : `bestrewardsPercent=0` tant que le compte n'est pas authentifié/réclamé ;
   - promo : `discount += result.discount` au lieu de remplacer la remise rate plan.
4. Ajouter des tests DB/runtime : invité + rate plan + promo ; client connecté + rate plan + promo + wallet ; cas sans promo pour vérifier la non-régression.

---

### 🔴 F2 — P1 — Un hôte peut confirmer/clôturer une réservation non payée et déclencher la fidélité

**Problème**  
`PUT /api/bookings/[id]` autorise `pending → confirmed` et `confirmed → completed` sans regarder `paymentStatus` ni `paymentIntentId`. Le cron, lui, ne complète automatiquement que les réservations `paymentStatus='paid'`. La route manuelle est donc plus permissive que le batch système.

**Impact utilisateur / métier**
- Un paiement en ligne en attente peut être confirmé manuellement par l'hôte puis ne plus expirer, car le cron d'expiration ne cible que `status='pending'`.
- Un séjour `confirmed` mais `paymentStatus='pending'` peut être passé en `completed`, poser `loyaltyAwardedAt` et rendre l'avis éligible alors qu'aucun règlement n'est constaté.
- Risque de BestRewards/cashback et d'avis vérifié sur un séjour impayé.

**Solution sans régression**
1. Enrichir la validation de transition avec le contexte de paiement.
2. Autoriser `pending → confirmed` par hôte/admin seulement si :
   - réservation manuelle (`paymentIntentId IS NULL`) ; ou
   - paiement déjà `paid` / reconcilié ; sinon refuser avec message explicite.
3. Autoriser `confirmed → completed` uniquement si `paymentStatus='paid'`; garder `no_show` et `cancelled` disponibles selon les règles existantes.
4. Tests : confirmation booking online non payé → 409 ; confirmation manuelle → OK ; completion unpaid → 409 ; completion paid → OK.

---

### 🔴 F3 — P1 — Bypass de la validation hôte via `PUT /api/properties/[id]`

**Problème**  
Le flux `/api/properties/[id]/validate` vérifie bien `requireApprovedHost(prop.hostId)` avant `approve → active`. En revanche, le `PUT` générique autorise un admin à envoyer directement `{status:"active"}` sans appliquer ce gate.

**Impact utilisateur / métier**
- Un hébergement peut être publié alors que son hôte est encore `pending` ou `rejected`.
- La règle T-202 « un hôte doit être validé avant publication » n'est pas une invariant système, seulement une règle d'un endpoint.

**Solution sans régression**
1. Centraliser la transition vers `active` dans un helper unique (`activatePropertySafely`).
2. Appeler ce helper depuis `/validate`, les actions bulk et `PUT /api/properties/[id]` quand `data.status === "active"`.
3. Pour un bien dont le propriétaire est admin/non-host, conserver le comportement historique ; pour un propriétaire `role='host'`, exiger `approvalStatus='approved'`.
4. Tests : admin active un bien d'hôte pending → 409 ; admin active un bien d'hôte approved → 200 ; hôte non-admin reste interdit sur `status`.

---

### 🔴 F4 — P1 — Mode maintenance appliqué aux pages mais pas à plusieurs écritures API

**Problème**  
Le proxy redirige correctement les pages vers `/maintenance`, et quelques endpoints critiques appellent `assertNotMaintenance`. Mais plusieurs mutations restent accessibles : price-alerts, propriétés, chambres, conversations/messages, profil, etc. Probe : pendant `maintenanceMode=true`, `POST /api/price-alerts` répond **201**.

**Impact utilisateur / exploitation**
- Pendant une maintenance censée figer l'application, des utilisateurs peuvent encore créer/modifier des données via API ou onglets déjà ouverts.
- Les équipes peuvent intervenir sur la base en pensant que les écritures sont stoppées alors qu'elles continuent.

**Solution sans régression**
1. Définir une politique claire : auth/admin/health restent ouverts ; mutations métier non-admin retournent 503 + `Retry-After`.
2. Ajouter `assertNotMaintenance(user)` ou un wrapper `guardMutationDuringMaintenance` sur les endpoints de mutation non couverts.
3. Garder les lectures publiques nécessaires si le produit veut une vitrine en maintenance, mais bloquer les actions modifiantes.
4. Tests : `POST /api/price-alerts`, `POST/PUT /api/properties`, `POST/PUT/DELETE /api/rooms`, `POST /api/messages`, `PATCH /api/users/me` → 503 pour non-admin, OK admin si souhaité.

---

### 🟠 F5 — P2 — IDs/filters invalides provoquent encore des 500 au lieu de 400 propres

**Problème**  
Plusieurs routes valident certains verbes mais pas tous les chemins. Exemples runtime : `DELETE /api/properties/not-a-uuid`, `DELETE /api/rooms/not-a-uuid`, `GET /api/bookings?propertyId=not-a-uuid`, `GET /api/rooms?propertyId=not-a-uuid`, `GET /api/messages?conversationId=not-a-uuid` → **500**.

**Impact utilisateur / sécurité**
- Expérience API fragile : une faute de paramètre devient erreur serveur.
- Logs pollués par des erreurs Postgres `22P02` évitables.
- Surface de déni de service/log spam inutile.

**Solution sans régression**
1. Valider tous les UUID de `params` et `searchParams` avant requête Drizzle.
2. Harmoniser la réponse : `{error:"Identifiant invalide"}` en 400.
3. Ajouter des tests de non-régression par route et verbe.

---

### 🟠 F6 — P2 — Recherche avec dates passées : avertissement affiché mais résultats et liens restent actifs

**Problème**  
`/` et `/recherche` n'ont pas de `min=today` sur les inputs de dates. `validStay()` accepte les dates passées tant que `checkOut > checkIn`. La page affiche un avertissement, mais continue à afficher 8 hébergements et propage la query dans les liens.

**Impact utilisateur**
- L'utilisateur peut rechercher un séjour impossible et voir des résultats qui semblent disponibles.
- La fiche hébergement neutralise ensuite les dates passées, puis le checkout les refuse : le parcours se contredit en plusieurs étapes.

**Solution sans régression**
1. Créer un parseur partagé `parseFutureStay(checkIn, checkOut, today)`.
2. Ajouter `min={today}` sur les dates de l'accueil et de `/recherche`.
3. Côté SSR/API catalogue, traiter les dates passées comme invalides : soit liste vide + message clair, soit suppression explicite des dates de la query avant de propager les liens.
4. Conserver la garde forte T-205 du checkout (`POST /api/bookings` reste l'autorité finale).

---

### 🟠 F7 — P2 — Deux moteurs catalogue divergents (`/recherche` vs `/api/properties`)

**Problème**  
La page SSR `/recherche` et `GET /api/properties` implémentent deux moteurs différents. Divergences prouvées :
- `amenity=tv` côté page trouve les rooms et rend 8 résultats ; `amenities=tv` côté API renvoie 0.
- le filtre prix de la page convertit `displayCurrency=XAF`, l'API ignore cette devise.
- l'API contient aussi un bloc de filtrage `roomCount/stayDatesValid` dupliqué.

**Impact produit**
- Les futurs composants qui consommeront l'API n'auront pas les mêmes résultats que la page publique.
- Les bugs corrigés dans un moteur peuvent réapparaître dans l'autre.

**Solution sans régression**
1. Extraire un service `catalog-search` unique, paramétrable pour SSR et API.
2. Supporter temporairement les deux contrats `amenity` et `amenities` côté API pour compatibilité.
3. Appliquer la même conversion de prix et la même logique room/property amenities partout.
4. Tests croisés : même requête → mêmes IDs sur `/recherche` et `/api/properties`.

---

### 🟠 F8 — P2 — Sélecteur enfants de la fiche hébergement non borné par la chambre

**Problème**  
`PropertyBookingCard` borne les adultes via `maxAdults`, mais propose toujours les enfants `[0,1,2,3,4]` sans `maxChildren` ni `maxOccupancy`. Le checkout recadre ensuite silencieusement après chargement de la chambre.

**Impact utilisateur**
- L'utilisateur peut choisir 4 enfants sur une chambre `maxChildren=0` et arriver au checkout avec une valeur modifiée ou refusée.
- Le parcours fiche → réservation paraît incohérent.

**Solution sans régression**
1. Passer `maxChildren` à `PropertyBookingCard`.
2. Calculer `childrenLimit = min(maxChildren, maxOccupancy - adults)`.
3. Re-clamper `children` quand `adults` change.
4. Garder la validation serveur actuelle dans `evaluateBookingRules`.

---

### 🟠 F9 — P2 — Messagerie : conversations vides et accès admin incomplet dans la navigation

**Problème**  
Le bouton « Contacter l'hôte » crée immédiatement une conversation, puis redirige vers un fil vide. Si l'utilisateur repart sans écrire, la messagerie peut contenir des conversations sans message. Par ailleurs, `/dashboard/messages` fonctionne en accès direct pour admin, mais les sidebars desktop/mobile admin n'affichent pas ce lien ; l'API `GET /api/conversations` ne reflète pas non plus la visibilité admin.

**Impact utilisateur / support**
- Pollution des listes par des fils vides.
- L'admin dispose d'une fonctionnalité partielle mais peu découvrable.

**Solution sans régression**
1. Transformer « Contacter l'hôte » en composer initial : créer conversation + premier message dans une transaction au moment de l'envoi.
2. Ou, solution minimale, masquer les conversations sans message dans les listes générales, tout en autorisant le fil récemment ouvert.
3. Ajouter `dashboard/messages` à la navigation admin si la messagerie admin est retenue.
4. Aligner `GET /api/conversations` pour admin ou documenter qu'il est strictement voyageur/hôte.

---

### 🟠 F10 — P2 — Suppression de compte possible malgré obligations actives

**Problème**  
`DELETE /api/users/me` soft-delete/anonymise tout compte non-admin sans vérifier les réservations futures, réservations non soldées, propriétés actives ou conversations en cours. Pour un hôte, les propriétés actives resteraient rattachées à un compte supprimé/anonymisé.

**Impact utilisateur / métier**
- Hôte supprimé alors que ses hébergements restent vendables.
- Réservations ou litiges sans interlocuteur exploitable.
- Risque support/RGPD : il faut concilier droit à l'effacement et obligations contractuelles.

**Solution sans régression**
1. Passer la suppression en workflow : blocage si obligations actives.
2. Customer : exiger annulation/fin des séjours futurs ou non soldés.
3. Host : exiger archivage/transfert des propriétés actives et résolution des bookings ouverts.
4. Après résolution, conserver l'anonymisation existante.
5. Tests : customer avec booking futur → 409 ; host avec propriété active → 409 ; compte sans obligation → suppression OK.

---

### 🟡 F11 — P3 — Facture/reçu disponible même pour une réservation non payée

**Problème**  
Le bouton « Facture / reçu » est visible sur toutes les lignes de réservation. `buildInvoiceData()` décide `isInvoice` selon la présence des données légales, pas selon `paymentStatus`/`status`.

**Impact utilisateur / comptabilité**
- Un document peut porter un numéro de facture alors que le paiement est encore `pending`.
- Confusion entre confirmation de demande, reçu et facture payée.

**Solution sans régression**
1. Renommer le document selon l'état : confirmation/pro-forma pour unpaid, reçu/facture pour paid.
2. Ne générer un numéro de facture définitif qu'une fois payé si la politique comptable l'exige.
3. Garder l'endpoint et l'accès existants ; seul le libellé et les métadonnées du document changent.

---

### 🟡 F12 — P3 — `maxUses` des promotions non verrouillé contre la concurrence

**Problème**  
`POST /api/bookings` lit la promo, vérifie `currentUses < maxUses`, puis incrémente `currentUses`, mais la ligne promotion n'est pas verrouillée explicitement avant la décision.

**Impact métier**
- Deux réservations concurrentes peuvent théoriquement dépasser un `maxUses` très faible.

**Solution sans régression**
1. Lire la promo `FOR UPDATE` dans la transaction avant `isPromoUsable`.
2. Incrémenter seulement après insertion booking réussie.
3. Test concurrent avec `maxUses=1` : exactement un succès, les autres en 409.

---

### 🟡 F13 — P3 — Harnais de simulation obsolètes après T-205

**Problème**  
Les validations runtime ne peuvent plus repasser vertes à cause de deux attentes obsolètes :
- surface : réservation manuelle attendue `confirmed` alors que le nouveau contrat est `pending` ;
- deep : `/mon-compte` analysé seulement via `page.tsx`, pas via `account-client.tsx`.

**Impact équipe**
- Les vrais signaux d'alerte sont noyés dans deux faux KO.
- Le statut « tout passe » devient impossible sans explication manuelle.

**Solution sans régression**
1. Mettre à jour `scripts/simulate.py` : `POST /api/bookings` manuel attendu `201 + status=pending + manualConfirmation=true` ; si `payOnline:true`, garder les assertions paiement dédiées.
2. Mettre à jour `scripts/deep_sim.py` : `read_page_bundle()` suit les imports siblings usuels (`account-client.tsx`, etc.) ou accepte une allowlist par page.
3. Ajouter une assertion positive sur les composants compte réellement présents dans le bundle.

---

## 3. Priorisation recommandée

| Priorité | Findings | Pourquoi |
|---|---|---|
| **À corriger en premier** | F1, F2, F3, F4 | Finance, fidélité/paiement, publication illégitime, maintenance opérationnelle. |
| **Ensuite** | F5, F6, F7, F8, F9, F10 | Robustesse API, cohérence du parcours recherche/réservation, UX enfants/messagerie, obligations compte. |
| **Après stabilisation** | F11, F12, F13 | Comptabilité/libellés, concurrence promo, harnais QA. |

---

## 4. Plan de correction sans régression proposé

1. **Lot financier booking** : F1 + tests ciblés quote/POST, sans toucher aux contrats de réponse existants.
2. **Lot lifecycle paiement** : F2 + tests transitions, en conservant le paiement manuel mais en empêchant completion unpaid.
3. **Lot publication/maintenance** : F3 + F4, avec helpers partagés et tests admin/non-admin.
4. **Lot robustesse API** : F5 + F13 pour retrouver un runner vert.
5. **Lot recherche/catalogue** : F6 + F7 + F8, moteur partagé + garde dates futures + UX capacité.
6. **Lot messagerie/compte/documents** : F9 + F10 + F11.
7. **Lot concurrence promo** : F12, test concurrent dédié.

Chaque lot est isolable, validable et réversible. Les fonctionnalités T-205 à préserver explicitement pendant les corrections : paiement manuel/en ligne, devis checkout serveur, wallet, gate hôte approuvé, motifs de modération, disponibilité réelle, référentiels partagés, messagerie admin, payout setup, soft-delete chambres, calendrier UI/API, avis approuvés, wishlists actives.

---

## 5. État final de cette analyse

- Aucun fichier produit T-205 n'a été supprimé ou réinitialisé.
- Les données de probes créées pendant l'audit ont été nettoyées ; `maintenanceMode=false` restauré.
- Un serveur Next production reste lancé sur `0.0.0.0:3000` pour inspection manuelle.
- Prochaine étape : arbitrer puis implémenter les lots ci-dessus selon les règles `.ai/` : analyse d'impact dédiée avant code, conception pour les lots structurants/critiques, tests ciblés + build + simulations.
