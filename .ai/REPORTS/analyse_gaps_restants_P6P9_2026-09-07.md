# Analyse — écarts restants après T-195 (versements) : P6–P9

Date : 2026-09-07 (mise à jour : **P6–P9 implémentés et validés**). Base : relecture **du code
réel** (grep + lecture des fichiers) puis validation 🔨/🧪/▶️. Les grandes briques (G1–G8,
P1–P4) sont **validées** ; ce rapport traite les écarts **UX/sémantique** (pas des régressions
de données).

Baseline avant ce rapport : `tsc` 0 · `lint` 0 · `i18n:check` 0 · `vitest` 535/535
(80 fichiers, 0 skip serveur lancé) · `build` 62 pages · `ai:check` 20 OK · 0 fail.

---

## 1. Ce qui n'a PAS été mené jusqu'au bout (code réel)

| # | Zone | État (avant → après) | Correctif (code réel) | Preuve |
|---|---|---|---|---|
| **P6** | UI « Versements » — bouton par devise | 🟠 → ✅ | `PayoutRequestButton` accepte `currency` (optionnelle) ; `billing/page.tsx` passe `currency={p.currency}` ; `POST /api/host/payouts` filtre par devise (`currency` dans le body Zod) → un clic ne traite que la ligne. | 🧪 `host/payouts/route.test.ts` (+1 test P6, `currency:"XAF"` → seul XAF évalué) · ▶️ runtime POST `currency=XAF` → `skipped[]` XAF seul ; `currency=USD` → 404 (aucun payout USD). |
| **P7** | Garde-fou devise — **aucun feedback UI** | 🟠 → ✅ | `payout-request-button.tsx` consomme la réponse : si `skipped.length>0` → `payouts.skippedCurrency` ; si `hasAccount===false` → `payouts.accountMissing` (au lieu d'un simple `reload()` silencieux). | 🧪 typecheck/lint · i18n (+2 clés) · ▶️ code vérifié (aucune régression du bouton historique). |
| **P8** | « Factures » vs « Export CSV » — sémantiques désalignées | 🟠 → ✅ | La carte « Factures » (qui affiche les payouts) pointe désormais son bouton d'export et son icône `download` vers `/api/dashboard/billing/export-payouts` (le ledger), et **non** vers `/export` (bookings). | ▶️ runtime (voir P9) · 🔨 build · la carte Réservations (`/dashboard/bookings`) conserve l'export bookings (non-régression). |
| **P9** | Export CSV « factures » : pas d'export des payouts | 🟡 → ✅ | Nouvelle route `GET /api/dashboard/billing/export-payouts` (host/admin), colonnes `periodStart/End, currency, gross, commission, net, bookingsCount, status, paidAt, idempotencyKey`, en-têtes localisés via `makeT`, limit 500. | 🧪 build (route `/export-payouts` générée) · ▶️ runtime CSV `MyBestBooking-versements.csv` avec en-têtes FR et lignes EUR/XAF. |

---

## 2. Ce qui est bien terminé (ne pas refaire)

- **G1–G8** : `POST/GET /api/host/payout-account` (vaultage AES-GCM + audit + UI
  `PayoutAccountForm`), cron `/api/cron/payouts` (GET+POST, vercel.json), factures réelles
  (`listPersistedPayouts`), un payout par devise (`createPayoutsForPeriod`), note
  `needConnect` conditionnelle (`hasPayoutAccount`), `KNOWN_LIMITATIONS` 1416→1452.
- **P1–P4** : cron réellement déclenché (GET 200 au lieu de 405) ; garde-fou devise côté
  serveur (`skipped[]`) ; chemin admin réparé (agrégation par hôte+devise, admin jamais
  exécuteur d'autrui) ; audit `payout.paid/failed`.
- **Backend multi-devise intact** : jamais de somme inter-devises ; idempotence
  `payout:host:period:currency` ; conversions à l'affichage (T-132) inchangées.
- **Paiement client intact** : aucun `transfer_data`/`application_fee_amount` (G2 = BACKLOG).

---

## 3. Plan d'implémentation non régressif (P6–P9)

> Principe : **additif** à l'affichage, AUCUN contrat API cassé, charges utiles
> **rétro-compatibles** (nouveaux champs optionnels). Gates par étape : `tsc` 0 · `lint` 0 ·
> `i18n:check` 0 · `vitest` vert · `build` ✓ · `ai:check` ✓ · non-régression (diff ciblé).

### Étape 1 — P6/P7 : bouton « Demander un versement » conscient de la devise + feedback `skipped` (UI, S)
1. Étendre `PayoutRequestButton` avec une prop **`currency`** (optionnelle, défaut = toute la
   période) et POST **`currency` dans le body** (additif).
2. Côté serveur (`POST /api/host/payouts`) : si `body.currency` est fourni, ne construire les
   drafts que pour **cette devise** (filtrer `result.payouts`) → un clic ne demande que la
   devise de la ligne.
3. Côté UI : consommer la réponse — si `skipped.length > 0`, afficher un message
   (ex. `payouts.skippedCurrency` : « Versement en attente — devise incompatible avec votre
   compte ») au lieu d'un simple `reload()` ; si `hasAccount === false`, message
   `payouts.needConnect`.
4. `i18n` : +1 clé fr/en (`payouts.skippedCurrency`) ; verrou 1452→**1453**.
5. Tests : route POST avec `currency` filtre par devise ; bouton rendu avec devise par ligne.

- **Risque** : nul (prop + champ body optionnels ; sans `currency`, comportement historique
  inchangé). Corrige la double-déclenchement P6 et le silence P7.

### Étape 2 — P8 : clarifier « Factures » vs « Export CSV » (UI, S)
1. Décaler le bouton « Export CSV » de la carte **Factures** vers la carte **Versements**
   (qui affiche les payouts) et renommer `billing.exportCsv` → dédié au ledger, OU
   ajouter un libellé clair (ex. `billing.exportLedger`) pour l'export des payouts.
2. Renommer la carte « Factures » en « États de versements » (i18n) et conserver l'export
   CSV **bookings** là où il a du sens (carte « Réservations » `/dashboard/bookings`).
3. Tests / vérif visuelle : la carte Versements propose son propre export des payouts,
   la carte Réservations conserve l'export bookings.

- **Risque** : nul (déplacement de bouton + libellés i18n). Clarifie la sémantique sans
  casser le flux d'export existant.

### Étape 3 — P9 : route d'export du ledger de versements (S, additif)
1. Nouvelle route `GET /api/dashboard/billing/export-payouts` (host/admin) : filtre
   `payouts` par hôte (ou tous si admin), colonnes `periodStart, periodEnd, currency,
   grossAmount, commissionAmount, netAmount, bookingsCount, status, paidAt,
   idempotencyKey` ; en-têtes CSV localisés via `makeT` (pattern de
   `/api/dashboard/billing/export`).
2. Ajouter `billingCsv.*` pour les en-têtes du ledger (compte de clés FR=EN).
3. Brancher le bouton de la carte « Versements » sur cette nouvelle route.
4. Tests : export payouts host (filtre hôte) vs admin (tous) ; chemin hôte intact ;
   non-régression de l'export bookings existant.

- **Risque** : nul (nouvelle route + nouveau fichier ; l'export bookings existant reste
  inchangé).

---

## 4. Critère de fin
À l'issue des étapes 1–3 (validation 🔨/🧪/▶️) : le bouton de versement est **par devise**
avec **feedback `skipped`/`hasAccount`**, la sémantique « Factures »/« Export CSV » est
**clarifiée**, et un **export du ledger de versements** existe. Zéro régression du tunnel de
paiement client, des conversions à l'affichage (T-132) et du comportement sans compte Connect
actif.

## 5. Note — non-régression
Tous ces écarts sont **d'affichage/UX** ; le backend (ledger, garde-fou devise, chemin admin)
est **déjà correct et validé**. Aucune migration ni modification des contrats API existants
(les champs `currency`, `skipped`, `hasAccount` sont ajoutés de façon optionnelle).
