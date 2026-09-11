# Validation — audit n°7, lot A (C1 → T-265, C2 → T-266)

- **Date** : 2026-09-11 · **Branche** : `arena/01a0913d-mybestbooking`
- **Périmètre** : constats **C1** (demande pending confirmable après suspension de l'annonce /
  désactivation de la chambre) et **C2** (remboursement hors plateforme « en cours » indéfiniment)
  de l'audit n°7.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_n7_fins_de_parcours.md` § 3 (C1, C2)
- **Analyse d'impact** : `analyse_impact_T265_T270_2026-09-11_audit7.md` (antérieure au code, §14)

## 1. Livré

| Tâche | Constat | Livrable |
|---|---|---|
| **T-265** | C1 — la transition `pending → confirmed` ne re-vérifiait ni le bien, ni l'hôte, ni la chambre : confirmation 200 sur une fiche publique en 404 (rejoué à l'exécution, réservation 01d24b95) | **nouveau** `src/lib/booking-availability.ts` : `confirmBookingAvailabilityError(tx, booking)` — prédicats **identiques** à `POST /api/bookings` (T-233 : bien `active`, hôte ni suspendu ni supprimé, `rooms.isActive`) ; appelée **sous le lock** de la transaction de confirmation (pas de fenêtre de course) + vérification rapide hors transaction sur le bien déjà chargé ; `PUT /api/bookings/[id]` : branche `confirmed` → 409 `Hébergement non disponible` / `Chambre non disponible` (pattern `BOOKING_UNAVAILABLE:`, réponse traduite EN par `apiError` comme les 409 existants) |
| **T-266** | C2 — annulation d'un paiement sur place : `refundStatus='pending'` sans aucun chemin vers `refunded`, écran « Remboursement : X € en cours » à vie, e-mail silencieux sur la modalité (rejoué : MBB-2026-MBWQ4R, 314,07 €) | (a) `/mes-reservations` : quand `paymentMethodOffline` et `refundStatus='pending'` → « Remboursement : X € — **à traiter par l'hébergeur** » (nouvelle clé `bookings.refundManual` FR/EN) ; la base n'est pas touchée (`pending` reste le juste état : dû, non constaté) et le futur chemin PSP garde « en cours » ; (b) **e-mail d'annulation voyageur** : ligne ajoutée **seulement** si un remboursement est dû — montant + modalité (hors plateforme : « sera traité directement par l'hébergeur » / en ligne : « est en cours »), via `mailStrings` FR/EN (`cancelRefundOffline`/`cancelRefundPending`) ; la ligne est ajoutée par la plateforme **après** le gabarit admin (pas un placeholder) : un gabarit personnalisé sans référence reste valide, et l'e-mail sans remboursement est **strictement inchangé** |

### Écarts d'implémentation documentés (cf. impact §14.5)

- La garde C1 **n'est pas** étendue aux clôtures `completed`/`no_show` : clôturer un séjour déjà
  passé est de la comptabilité, pas un nouveau séjour ; la bloquer après une suspension
  postérieure empêcherait l'hôte de solder ses séjours (régression workflow).
- Le badge dashboard hôte « remboursement à traiter » (étape 3 optionnelle) et la notification à
  la suspension (C1 étape 3) restent des **décisions produit** — portés dans `KNOWN_LIMITATIONS.md`.

## 2. i18n

- **1 clé ajoutée** FR/EN appariée : `bookings.refundManual` (« à traiter par l'hébergeur » /
  « to be handled by the host »). Verrou `src/lib/ui-strings.test.ts` : **1768 → 1769**.
- Les 2 chaînes d'e-mail passent par `mailStrings` (fichier `mail/strings.ts`, hors verrou UI).

## 3. Preuves automatisées

- `src/app/api/bookings/[id]/route.t265.test.ts` — **4/4** (base réelle, auth mockée, fixtures
  purgées) :
  1. **cas sain** : demande pending → confirm 200 + `confirmedBy` posé (non-régression bloquée) ;
  2. bien suspendu après la demande → **409** « Hébergement non disponible », statut resté `pending` ;
  3. hôte suspendu, annonce restée `active` → **409** (le filtre hôte actif protège, même sans
     cascade — filet T-233) ;
  4. chambre `isActive=false` → **409** « Chambre non disponible », statut resté `pending`.
- `src/lib/booking-cancellation-refund-mail.t266.test.ts` — **3/3** (base réelle, outbox) :
  1. paiement sur place annulé → e-mail voyageur : « 500.00 EUR sera traité directement par
     l'hébergeur », **sans** « est en cours » ;
  2. paiement en ligne (réconciliation PSP) → « est en cours », sans « hébergeur » ;
  3. demande non payée → **aucune** ligne de remboursement (e-mail inchangé).
- Non-régression des voisins : `ui-strings` (verrou 1769), `booking-cancellation-mail` (T-150),
  `booking-cancellation-actor` (T-156), `route.t216` (transitions + audit), `route.t203`
  (markPaidOffline), `booking-confirmation` (T-203), `booking-lifecycle` (FSM) → **41/41**.
- `tsc --noEmit` 0 · `eslint src --max-warnings 0` 0/0 · `i18n:check` warn-only (6 candidats
  pré-existants, inchangés).

## 4. Portée

Aucun contrat modifié : la FSM (`booking-lifecycle.ts`) est intacte ; `POST /api/bookings`, le
cron d'expiration, la clôture `completed` et le paiement sur place sont inchangés ; le seul
comportement ajouté est un **409** sur un état que la création refuse déjà. Les e-mails existants
sans remboursement sont strictement identiques.
