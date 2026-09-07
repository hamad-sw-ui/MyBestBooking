# Tâche courante

- **ID** : T-202
- Titre : Validation hôte par l'admin + paiement manuel (statuts gérés à la main)
- **Statut** : IMPLEMENTÉ (VALIDÉ) ✅
- **Niveau** : **S**

## Description
L'inscription d'un hôte passe désormais par la **validation de l'admin** avant
de pouvoir publier ses hébergements. À l'approbation, l'admin **fixe un
pourcentage de commission** pour cet hôte. Le client **ne paie plus
automatiquement** à la réservation ; les **états de réservation** (en attente,
confirmé, terminé, no-show, annulé) sont **gérés manuellement**, principalement
par l'hôte. Décisions (issues des clarifications) :
- **Modèle paiement** : `manual_confirm` — réservation = demande `pending`,
  paiement en ligne plus déclenché auto. La route `/api/bookings/[id]/payment`
  reste (back-office).
- **Acteur des statuts** : `host_all` — l'hôte confirme/complète/no-show/annule ;
  le client annule sa demande ; l'admin arbitre.
- **Priorité commission** : `host_override` — propriété > hôte > global.
- **Gate hôte** : `block_publish` — un hôte non approuvé crée/soumet mais ne
  passe jamais `active`.

## Sprint de fermeture (tous ✅)
- [x] 🔨 tsc 0 · eslint 0 · i18n:check 0 (catalogue **1477**) · build 64 pages
      (+ routes `/api/admin/hosts` + `/api/admin/hosts/[id]`)
- [x] 🧪 vitest **546/546** (82 fichiers, 0 skip) — +10 tests (5 `admin/hosts`,
      5 `commission`)
- [x] ▶️ runtime prod : `POST /api/bookings` (sans `payOnline`) → `status:"pending"`,
      `payment:null`, `manualConfirmation:true` ; `PUT /api/bookings/[id] {status:"confirmed"}`
      → `confirmedBy:<hostId>` (confirm manuelle par l'hôte) ; hôte démo `approved` ;
      gate `validate`→409 si hôte non approuvé ; base restaurée baseline.
- [x] ✅ ai:check 19 OK · 0 fail · R7 STATE.md synchronisé (toléré en fin de session)

## Précédentes tâches
- T-195 — Versements hôtes/admins + gaps P1–P9 — **CORRIGÉ (VALIDÉ)** ✅
- T-194 — Accès démo en un clic (`/connexion`) — **VALIDÉ** ✅
- T-193 — `npm run site:audit` (audit runtime, 0 issue) — **VALIDÉ** ✅
- T-192 — KNOWN_LIMITATIONS purgé + env:restore — **VALIDÉ** ✅

## Prochaine
- **ID** : G2 (BACKLOG) — split/paiement Stripe Connect externe
  (`transfer_data.destination`/`application_fee_amount`) — **hors sandbox**,
  à traiter uniquement lorsque des clés Connect de test sont disponibles.
- Reste à décision utilisateur : activer le workflow GHA (permission) ;
  arbitrer T-108→T-112 ; polices auto-hébergées si CDN accessible ;
  UI host de rejet (re-soumission après `rejected`) à affiner.
