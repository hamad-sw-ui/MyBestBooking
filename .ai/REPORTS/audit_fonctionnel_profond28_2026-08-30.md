# Audit fonctionnel profond n°28 — scénarios & éléments inachevés ou mal pensés (à l'exécution)

**Date :** 2026-08-30
**Branche :** `arena/01a052ed-mybestbooking` (base `2cdb852` — T-155 livré)
**Méthode :** crawl **40 pages × 4 rôles** (160 vérifications HTTP,
`.data/a28/pages.json`, 0 marqueur d'erreur) + **30 routes API × 4 rôles**
(120 vérifications, `.data/a28/apis.json`, 0 ERR/500 après restart du
serveur) + **~20 probes de parcours réels** (curl avec sessions
customer/host/admin) + lecture des flux critiques (réservation, annulation,
messagerie, wishlist partage, parrainage, promotions, settings,
maintenance) + inventaire statique (i18n, handlers morts). Pour chaque
écart : **problème → preuve runtime → cause dans le code → solution sans
régression**. **Aucune modification de code** dans ce rapport ; la baseline
est rejouée en fin (`run_all_sims.py` : **5/5 · 396 OK · 3 WARN · 0 KO**).

---

## ✅ Ce qui est sain (vérifié à l'exécution)

- **Crawl** : 160 vérifs pages (0 erreur ; 307/302 conformes : anonyme →
  `/connexion?next=…` sur les pages privées, host → `/dashboard` sur les
  sections admin-only, customer → `/` sur le dashboard) · 120 vérifs API
  (zéro ERR/500 ; 401/403/405/400 conformes aux contrats).
- **`/reservation` anonyme → 200** : **intentionnel** (T-030/T-109) — le
  checkout passe en guest mode (champs invité + claim par email) au lieu de
  bloquer. Aligné sur les sims depuis l'audit n°27.
- **Mode maintenance** (T-128) : la garde est côté client
  (`MaintenanceGate` → `window.location.replace("/maintenance")` après
  `GET /api/maintenance-status`) ; les **écritures** métier sont bloquées
  serveur (`assertNotMaintenance` sur bookings/reviews/promos-apply/uploads/
  avatar). Le mode s'active via PATCH admin (section complète). Les
  lectures publiques restent ouvertes par design — documenté.
- **Facture/Reçu** : `GET /api/bookings/[id]/invoice` → 200 pour le
  propriétaire (hôte) ET le voyageur, 401 anonyme ; 1,7 s à froid (cold
  compile), 145 ms à chaud — **pas de bug de perf**.
- **Parrainage** : `POST /api/auth/register { referralCode }` →
  `users.referred_by` bien renseigné (vérifié en DB) puis `GET
  /api/users/me/referral` expose le code ; carte « Mon code de parrainage »
  avec copie.
- **Wishlist partage** : liste publique → `shareToken` ; `GET
  /api/wishlists/shared/{token}` anonyme → nom + items ;
  `/wishlists/share/{token}` → 200 (rendu client).
- **Messagerie** : conversation liée à la réservation (uniquement pour le
  propriétaire de la résa — 403 sinon), `POST /api/messages {conversationId,
  content}` → `unreadByHost` incrémenté (vérifié 0→1), lecture → 200.
  L'API utilise bien `content` comme l'UI (`message-composer`).
- **Promotions admin** : gardes de rôle (host → 403 « Accès admin requis »),
  validations métier localisées (`La date de fin doit être postérieure à la
  date de début`, `Une remise en pourcentage doit être comprise entre 0 et
  100`).
- **Chiffres hôte cohérents** : dashboard 25 298,75 € (brut) · analytics
  25 298,75 € (30 j) · facturation 21 503,90 € (net = brut × 0,85,
  commission 15 %). Pas de divergence fantôme.
- **Recherche (SSR) en EN** : libellés traduits (Guests, Travelers, All
  types…) ; tri prix sur MIN EUR avec conversion (`minPriceEur`) et
  affichage dans la devise d'origine — correct (audit n°26).
- **Aucun TODO/FIXME, aucun `href="#"`, aucun handler vide** dans `src/`
  (scan statique) ; `RESET` de l'environnement (serveur + PG) → rien à
  signaler côté données hormis l'hygiène des sims (voir P3-5).

---

## 🔴 P1 — Finding critique

### 1. Annulation par l'hôte : les frais d'annulation sont facturés au voyageur, et le bouton hôte « Annuler » est inopérant

**Problème.** Le cycle d'annulation est pensé pour un **voyageur** : les
frais sont calculés par la grille de la politique, **quel que soit
l'acteur qui annule**. Si un hébergeur annule (ou un admin), le voyageur
est pénalisé financièrement pour une décision qui n'est pas la sienne :
avec une politique `flexible` (< 24 h avant l'arrivée → 100 %), une
annulation par l'hôte la veille du séjour prive le voyageur de la totalité
du remboursement. En parallèle, le bouton « Annuler » affiché à l'hôte
appelle d'abord `GET /api/bookings/[id]/cancellation`, qui n'autorise que
le propriétaire de la réservation (ou admin) → **403 « Accès refusé »** →
le bouton ne fonctionne pas (l'erreur s'affiche en rouge).

**Preuve runtime (sessions réelles).**
1. Création compte connecté : booking `MBB-2026-YVXL9W` (277,38 €,
   check-in 2026-08-31 = < 24 h, propriété `flexible`, chambre
   dae66356…).
2. `GET /api/bookings/{id}/cancellation` **en hôte-propriétaire du bien**
   → `403 {"error":"Accès refusé"}` (le même appel que `cancel()` de
   `booking-row-actions`).
3. `PUT /api/bookings/{id}` `{status:"cancelled", cancellationReason:
   "Annulation demandée par le voyageur"}` (corps exact du bouton hôte)
   → 200 avec : `cancellationFee: 277.38`, `refundAmount: 0.00`,
   `refundStatus: none`, `cancellationReason: "Annulation demandée par le
   voyageur"`.
4. Outbox : voyageur (`audit.cancel@t.local`) → « Réservation annulée
   MBB-2026-YVXL9W — **Frais d'annulation appliqués : 277.38 EUR** » ;
   hôte → « Annulation de votre réservation MBB-2026-YVXL9W ».

**Cause (code réel).**
- `src/components/booking-row-actions.tsx` : le bouton « Annuler » est
  rendu pour **tous** (`status confirmed/pending`), y compris en vue
  hôte (`messageArea="dashboard"`) ; `cancel()` appelle le quote puis PUT
  avec la raison en dur `"Annulation demandée par le voyageur"`.
- `src/app/api/bookings/[id]/cancellation/route.ts` : garde
  `row.booking.userId !== user.id && user.role !== "admin"` → l'hôte du
  bien est exclu.
- `src/app/api/bookings/[id]/route.ts` : la transition `host → cancelled`
  est permise (`transitionError`) et le handler délègue à
  `cancelBooking(id, reason)` **sans notion d'acteur**.
- `src/lib/booking-cancellation.ts` : `cancelBooking` applique
  `computeCancellationFeeWithGrid(policy, total, daysUntil(checkIn))` et
  persist `cancellationFee`/`refundAmount` — aucun branchement sur qui
  annule.

**Solution sans régression.**
1. `cancelBooking(bookingId, reason, actor)` (additif) :
   - `actor === "customer"` → comportement **actuel inchangé** (grille,
     frais, emails) ;
   - `actor === "host" | "admin"` → `cancellationFee = 0`,
     `refundAmount = total`, raison serveur `"Annulée par
     l'hébergeur"` / `"Annulée par l'administrateur"` (la raison client
     est ignorée), emails avec le libellé adapté (le voyageur est informé
     « votre hébergeur a annulé », pas « frais appliqués »).
2. Route `PUT /api/bookings/[id]` : passer l'acteur (déjà connus via
   `actorFor`) à `cancelBooking` ; `cancellationReason` client réservé
   au voyageur.
3. `GET /api/bookings/[id]/cancellation` : autoriser aussi **l'hôte du
   bien** (retour `fee: 0` + mention « annulation hôte ») → le bouton
   hôte redevient fonctionnel ; le UI hôte en profite pour afficher un
   dialogue dédié (« Annuler la réservation du voyageur ? Remboursement
   intégral… »).
4. Tests : route PUT (host → fee 0/refund total/raison hôte), quote host,
   email hôte-annulation — aucun test existant ne change (cas voyageur
   identique).

---

## 🟠 P2 — Findings importants

### 2. Mode connecté : l'identité du voyageur est librement modifiable → confirmations envoyées au mauvais destinataire

**Problème.** Sur `/reservation`, l'étape 2 « Vos informations » affiche
Prénom/Nom/Email/Téléphone/Pays **préremplis mais éditables**, même pour un
compte connecté. Le serveur n'est pas l'autorité : pour un user connecté
(`isGuestBooking` absent/false), la garde « email appartenant à un compte
existant → 409 » n'est **pas** appliquée et `guestEmail` est utilisé tel
quel pour les emails. Résultat : le voyageur peut (typo ou manipulation)
saisir l'email d'un tiers — la confirmation de réservation, le reçu et la
relation de messagerie partent à un inconnu.

**Preuve runtime.** Compte connecté (session customer), `POST
/api/bookings` avec `guestEmail: host@mybestbooking.com` (l'hôte du bien !)
→ **201** ; `userId` = compte connecté ; `guestFirstName: "Audit"` ;
outbox → `To: host@mybestbooking.com` « Réservation confirmée
MBB-2026-WTKSPX » **+** notification hôte au même destinataire (l'hôte
reçoit sa propre confirmation de réservation).

**Cause.** `src/app/(main)/reservation/page.tsx` (champs éditables
l. ~570-590, envoi tel quel l. ~302-306, `isGuestBooking: guestMode ||
undefined`) ; `src/app/api/bookings/route.ts` : vérification d'unicité de
l'email **uniquement sous `if (isGuestBooking)`** (l. ~139-152).

**Solution sans régression.**
- **Serveur = autorité** : si `user` est connecté, la création de la
  réservation **ignore** les champs invité du payload et utilise
  l'identité du compte (`guestFirstName/LastName = user`,
  `guestEmail = user.email`) — le contrat public du guest mode reste
  intact (anon + `isGuestBooking` inchangés).
- **UI** : compte connecté → étape 2 en lecture seule (badge « Réservé
  au nom de Pierre B. · pierre@… ») ou masquée ; message clair.
- Option métier (si « réserver pour un proche » est souhaité) : case
  explicite « réserver pour quelqu'un d'autre » + confirmation envoyée à
  la fois au compte et au proche — à arbitrer, la valeur par défaut restant
  l'identité du compte.
- Tests : route (user connecté + guestEmail tiers → identité compte),
  UI non concerné.

### 3. Internationalisation partielle : fiche propriété et dashboards mélangent EN et FR

**Problème.** Le sélecteur FR/EN promet une interface bilingue, mais une
grande partie des écrans reste en français dur. Preuve : fiche publique
d'un **compte EN** → « Réserver » (11×), « par nuit » (12×), « Voir les
disponibilités », « Contacter l'hôte / Suivre le prix de base »,
« Annulation gratuite jusqu'à 24 h avant l'arrivée » — alors que d'autres
blocs sont bien traduits (« Book » 13×). Inventaire statique : **52
composants client** avec chaînes accentuées françaises et sans
`makeT`/dictionnaire (`help-center` articles entiers, `booking-row-actions`,
`review-form`, `availability-calendar`, `rate-plans-section`,
`settings-panel`, `new-room-form`, pages `properties/[id]` et
`properties/new`…).

**Solution sans régression (par vagues, sans casser le rendu FR).**
1. Ajouter les clés manquantes dans `src/lib/ui-strings.ts` (fr = texte
   actuel, en = traduction) ; migrer par priorité : fiche propriété
   (publique, P2), ensuite booking-actions/calendrier/composants de
   réservation, puis dashboards.
2. `HelpCenter` : articles en structure `{fr, en}` (le corps reste le
   même, sélection par langue) — zéro changement de comportement FR.
3. Garde-fou CI (warn, pas fail) : composant `"use client"` contenant
   des accents FR sans import `makeT` → signalé (comme R18 build-time).
4. L'EN reste **best-effort** : aucun libellé n'est retiré, le fallback
   fr garantit l'état actuel.

### 4. Recherche : les bornes de prix sont en FCFA pour tous les anonymes, sans sélecteur de devise

**Problème.** Le filtre prix (`search-price-filter.tsx`) est libellé dans
la **devise d'affichage** : `useDisplayPreferences` → défaut plateforme
(`general.defaultCurrency = "XAF"`) tant que l'utilisateur n'est pas
connecté avec une `currency`. Un champ caché `displayCurrency` accompagne
la soumission (la conversion serveur est correcte), mais **aucun sélecteur
de devise n'existe sur les pages publiques** (pas de `CurrencySelector`
dans `src/`) : le curseur de devise n'est réglable que dans « Mon compte ».
Un visiteur européen voit donc « Prix min. (FCFA) » et tape 100 (= 0,15 €)
→ 0 résultat, alors que les cartes affichent des prix en €.

**Preuve.** Rendu SSR : placeholder « FCFA min »/« FCFA max » ;
`grep CurrencySelector` → aucun composant ; `GET /api/admin/settings` →
`defaultCurrency: "XAF"`.

**Solution sans régression.**
- Ajouter un sélecteur de devise **dans le formulaire de recherche**
  (EUR/USD/GBP/XAF, persisté `localStorage` comme la langue, priorité
  compte > localStorage > plateforme > dérivée de la locale du serveur :
  `fr → EUR`, `en → USD`) — le hidden field `displayCurrency` et la
  conversion serveur restent le contrat.
- Ou, alternative minimale : `getServerLocale()`-timez default per locale
  + garder XAF en dernier recours. Aucun changement de schéma API.

---

## 🟢 P3 — Hygiène, cohérence, finitions

### 5. Les simulations polluent les vues de l'hôte (dashboards « démo »)

**Problème.** Les exécutions de `run_all_sims.py` laissent des
réservations/users de test dans les vues métier : dashboard hôte →
« Réservations 57 » dont « Gdpr Test », « Calc Test », « Wallet Test »,
« Supprimé Compte » (dates 2035-2046), et 16 hébergements dont les drafts
`deep-villa-*`. Le nettoyage du runner ne supprime que les bookings des
**derniers** runs (liste de prénoms) et **jamais les users** `@t.local`
(contrainte FK), d'où une accumulation visible — gênant pour une démo ou
une reprise de staging, même si sans impact sur les simulations.

**Solution.** Script `scripts/purge-sim-data.ts` (ou option du runner) :
DELETE sessions + verification_tokens + email_outbox + bookings des users
`%@t.local`/`%@test.local`, puis users correspondants (enfin les héritages
d'attachements), réservations invitées aux prénoms de la liste existante ;
listing de ce qui sera supprimé avant exécution (`--dry-run`). Le smoke
conserve son nettoyage réentrant ; rien ne change pour le produit.

### 6. `/api/admin/settings/[key]` : PATCH partiel rejeté et détails Zod anglais exposés

**Problème.** Un PATCH `{"maintenanceMode":true}` sur `security` →
**400** « Valeur invalide ou manquante » **+** tableau `issues` en anglais
(`Invalid input: expected number, received undefined`) car le schéma exige
la **section entière**. Le panneau admin envoie la section complète (OK),
mais le contrat est fragile (tout client partiel casse) et la réponse
divulgue les détails de validation internes (incohérent avec les autres
routes qui ne renvoient que `{error}`).

**Solution.** Merge additif par section (PATCH partiel = fusion sur la
valeur persistée, validation après fusion) + masquer `issues` dans la
réponse d'erreur (message français seulement) — sans changement du
contrat GET ni comportement admin existant.

### 7. Observation de cohérence : « capacité dépassée » → 409 (vs promo inconnue → 400 depuis T-155)

`numAdults > maxOccupancy` → **409** « Cette chambre accepte au maximum 2
adultes » (règle métier `BookingRuleError`), alors qu'un code promo
inconnu renvoie désormais 400. Les deux sont des entrées invalides ; le
409 reste défendable pour les règles de capacité. **Recommandation** :
aligner sur 400 pour la cohérence de l'API (message inchangé, test
existant à ajuster) — décision produit, aucun impact sur les flux UI (le
formulaire borne déjà les voyageurs).

---

## 📊 Validation & périmètre

- **Baseline rejouée** : `run_all_sims.py` → smoke 94 · surface 68 ·
  deep 80 · xtreme 83 (3 WARN par design) · paranoid 71 = **396 OK ·
  3 WARN · 0 KO**.
- **Aucun fichier `src/` modifié** : les preuves T-155 (tsc 0 · vitest
  372/372 · ai:check 19/1/0) restent valables ; les probes de ce rapport
  ont été purgées (réservations, wishlist, promo `AUD28X`, comptes
  `refaudit28*`, conversation/messages — vérifié en DB).
- **Environnement** : un serveur Next de la session précédente a été
  reçu SIGTERM pendant le crawl (récolte de processus, pas un crash
  produit) ; le crawl API a été rejoué sur serveur frais → 120/120.
- **Prochaines étapes (sur validation)** : T-156 (P1 annulation hôte),
  T-157 (P2 identité connectée), T-158 (P2 i18n vagues 1-2 + sélecteur
  devise recherche), T-159 (P3 hygiène sims + settings PATCH + 409→400).
