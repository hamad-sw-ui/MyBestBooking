# Audit fonctionnel profond n°24 — scénarios & éléments inachevés ou mal pensés (à l'exécution)

**Date :** 2026-08-30
**Branche :** `arena/01a052ed-mybestbooking` (base `ada5400` — T-150)
**Méthode :** crawls HTTP réels (anonyme / customer / host / admin) sur les
**41 pages** + les **61 routes API** ; lecture ciblée des flux critiques
(réservation, paiement, avis, messagerie, dashboard hôte, admin) ; grep
TOMO/FIXME/dead-UI. La revue portait sur les éléments **inachevés** ou
**mal pensés**, avec pour chacun : problème → preuve → solution **sans
régression**.
**Rapport associé implémenté :** T-151 (`validation_T-151_2026-08-30.md`).

---

## ✅ Ce qui est sain (vérifié à l'exécution)

- **RBAC complet** : anonyme → 307 connexion sur les 19 pages protégées ;
  customer → 307 `/` sur `/dashboard` ; host → 307 sur
  users/settings/audit/promotions ; admin 200 partout (« 200/307 »
  conforme T-123).
- **41 pages** rendent 200 sans « Application error » ; **61 routes API**
  répondent (404/401/403/200 selon le contexte, aucun 500).
- Flux **réservation → confirmation** (mock) : `POST /api/bookings` →
  `confirmed` + e-mails voyageur/hôte en outbox (propre).
- **Aucun** `TODO`/`FIXME`/`href="#"`/handler vide (R18/R19 déjà
  mécaniques).
- 2FA, avatars, pièces jointes, factures, partage wishlist, réponses hôte
  aux avis, modération admin : câblés (présence + exécution).

---

## 🔴 P1 — Findings majeurs

### A. Reprise de paiement & annulation d'une réservation **pending** inaccessibles

**Problème.** Une réservation `pending` (abandon au checkout, paiement
échoué, intent expiré) est **sans action** pour le voyageur sur
`/mes-reservations` : ni « Payer maintenant », ni « Annuler » (le bouton
Annuler de `BookingRowActions` n'apparaît que si `status === "confirmed"`,
et il n'existe aucun CTA de reprise de paiement). Le voyageur ne peut
reprendre le paiement que dans la **même session de checkout** (variable
`resumeBookingId`), et il doit attendre le cron pour l'expiration.

**Preuves.**
- `src/app/(main)/mes-reservations/page.tsx` : actions = « Voir
  l'hébergement » + `BookingRowActions` (pas de branche `pending`).
- `src/components/booking-row-actions.tsx` : `{status === "confirmed" && (
  <Button onClick={cancel}>Annuler</Button>)}` ; aucun bouton Payer.
- `src/app/api/bookings/[id]/payment` (POST) **existe déjà** et
  `resumePayment()` est codé dans `reservation/page.tsx` (l. 246) — mais
  il n'est jamais appelé depuis `/mes-reservations`.
- `cancelBooking()` accepte pourtant `status === "pending"` (l. 31 de
  `booking-cancellation.ts`) : l'API est prête, pas l'UI.

**Solution sans régression (additive).**
1. `BookingRowActions` : si `status === "pending"` et
   `paymentStatus === "pending"` → bouton **« Payer maintenant »** lié à
   `/reservation?booking={id}` ;
2. `reservation/page.tsx` : au montage, si `?booking=` est présent, charger
   `GET /api/bookings/{id}` (déjà utilisé l. 269), pré-remplir
   property/room/dates et appeler le `resumePayment()` existant ;
3. autoriser l'annulation `pending` dans `BookingRowActions` (condition
   `status === "confirmed" || status === "pending"`) — aucun changement
   backend (déjà supporté) ;
4. tests : smoke + test d'intégration route payment sur un booking
   `pending`.

---

### B. Devise « € » codée en dur dans le tunnel de réservation

**Problème.** `(main)/reservation/page.tsx` affiche `€{...}` pour le prix
unitaire, le sous-total, la remise et le total (l. 551, 580, 661, 668, 673)
alors que `rooms.currency` est une colonne DB (EUR par défaut, mais USD/GBP
possibles) et que `POST /api/bookings` facture bien `room.currency`. Une
chambre en USD serait affichée « €100 » mais débitée « 100 USD » — **fausse
information monétaire** en pleine étape de paiement.

**Preuves.**
- `src/db/schema.ts` : `rooms.currency` (l. 248) ; la fiche propriété
  renvoie les chambres **complètes** (devise incluse).
- `reservation/page.tsx` : interface `RoomData` **sans** `currency` (l.
  44-53) ; `€${pricePerNight.toFixed(2)}`.
- `POST /api/bookings` (l. ~331) : `currency: room.currency || "EUR"`.

**Solution sans régression.**
1. Ajouter `currency: string` à `RoomData` (l'API fournit déjà la valeur) ;
2. remplacer les 5 occurrences par `formatPrice(montant, room.currency)`
   (déjà utilisé partout ailleurs : `mes-reservations`, facture) — pour
   une chambre EUR le rendu devient « 200,00 € » (harmonisé, même valeur).
3. Garde-fou : test unitaire du calcul + smoke sur une chambre EUR
   (aucune donnée USD dans le seed → pas de régression de données).

---

## 🟠 P2 — Findings de cohérence

### C. Analytics & Billing : totaux additionnés sans devise explicite

**Problème.** `dashboard/analytics/page.tsx` et `dashboard/billing/page.tsx`
somment des `bookings.total` de devises potentiellement différentes et
appellent `formatPrice(somme)` **sans** devise → affichage EUR implicite.
Les lignes individuelles passent bien `booking.currency`. Tant que tout est
EUR (cas réel actuel) le rendu est correct ; dès qu'une chambre est en
USD/GBP, les totaux deviennent faux.

**Preuves.** `analytics/page.tsx` l. 191, 205, 277, 308
(`formatPrice(analytics.currentRevenue)`…) ; `billing/page.tsx` l. 166,
180, 194, 238 (totaux), l. 287 (ligne, `booking.currency` — correct).

**Solution sans régression.**
- Regrouper les sommes **par devise** (Map currency → somme) et afficher
  chaque groupe `formatPrice(somme, devise)` ; ou, plus simple et
  aligné sur `KNOWN_LIMITATIONS` (« une seule devise affichée »), **figer
  l'affichage de ces pages sur EUR** avec un commentaire explicite + garde
  `sum(currency)` qui log un warning si des devises mixtes apparaissent.
- Tests : page total sur données EUR inchangées (rendu identique).

---

### D. i18n UI partiel : 20/113 composants traduits, `<html lang="fr">` figé, aucun sélecteur de langue

**Problème.** La stratégie « la langue de l'interface suit `user.language` »
(T-132/T-149) n'est appliquée que partiellement :
- **20/113** `.tsx` utilisent `makeT`/`uiStrings` ; les autres écrans
  (bestrewards, messages, reservation, dashboard…) restent en dur français ;
- `src/app/layout.tsx` fixe `<html lang="fr">` (jamais `en`) — a11y/SEO ;
- **aucun sélecteur de langue** dans header/footer : un visiteur
  anglophone ne peut pas obtenir l'interface en anglais sans passer par le
  profil (après inscription) ; le formulaire d'inscription n'offre pas non
  plus le choix.

**Preuves.**
- `grep -rl "makeT|uiStrings|useDisplayPreferences" src --include=*.tsx | wc -l` → 20 ; total tsx → 113
- `src/app/layout.tsx` l. 60 : `lang="fr"` (aucun `useDisplayPreferences`).
- `header.tsx` / `footer.tsx` : aucune `<select>` de langue.

**Solution sans régression (par étapes).**
1. Ajouter un **sélecteur FR/EN** dans le header (composant client) :
   choix → `localStorage` + `PATCH /api/users/me` si connecté +
   `resetDisplayPreferencesCache()` ; réutilise les clés déjà présentes
   (aucune nouvelle chaîne).
2. Rendre `<html lang>` dynamique via un petit script client lisant les
   préférences (défaut `fr` → aucun changement tant que la langue est fr).
3. Migrer **au fil de l'eau** les composants vers `makeT` (le dictionnaire
   contient déjà 492 clés ; chaque migration est additive, défaut fr).
   Ordre de priorité proposé : pages publiques (bestrewards, aide),
   message/dashboard, puis dashboard hôte/admin.
4. Aucun test de régression de langue (les défauts restent fr).

---

### E. Avis : CTA « Laisser mon avis » toujours visible après dépôt + page avis sans état

**Problème.** Après avoir posté un avis, `/mes-reservations` affiche encore
le bouton « Laisser mon avis » pour la même réservation ; le clic ouvre le
formulaire (la page `/mes-reservations/avis/[id]` ne vérifie pas l'existence
de l'avis) et la soumission échoue en **400 « Vous avez déjà laissé un
avis »** — expérience « doublon » subie au lieu d'un état propre.

**Preuves.**
- `src/app/api/reviews/route.ts` : 400 correct si `existing` (l. ~152).
- `mes-reservations/avis/[id]/page.tsx` : sélectionne uniquement
  booking/user/status/checkOut — **aucun** `reviews` ;
- `mes-reservations/page.tsx` : `<Link href={…/avis/${booking.id}}>` pour
  tout `status === "completed"`.

**Solution sans régression.**
1. `GET /api/bookings` : `leftJoin(reviews)` + retour `reviewId`,
   `reviewStatus` (champs **additifs** — aucun appelant cassé) ;
2. `mes-reservations` : si `reviewId` → badge « ✓ Avis publié » (ou
   « En attente de modération » si `reviewStatus === "pending"`), sinon
   CTA actuel ;
3. page avis : si un avis existe → écran « Vous avez déjà publié votre
   avis (Note : X/10) » + lien vers l'hébergement (pas de formulaire) ;
4. tests : cas déjà-commenté et cas sans avis.

---

## 🟡 P3 — Mineurs

### F. Commentaire obsolète dans `register/route.ts`
Ligne 78 (« …reste à implémenter ») alors que le flux d'e-mail de
vérification **existe** depuis T-013 (confirmé dans ce rapport). → mise à
jour du commentaire (fait avec T-151).

### G. Observation (pas un défaut) — smoke dépend de la wishlist du seed
`scripts/smoke.sh` l. 322-349 saute l'assertion wishlist si la wishlist du
seed n'existe pas. Le seed la crée toujours ; cette dépendance est
acceptable mais fragile si un nettoyage supprime des données seed (arrivé
une fois pendant cette session : restaurée). → optionnel : le smoke peut
créer la wishlist lui-même (`POST /api/wishlists` sans `wishlistId` le
permet, route l. 96).

---

## 3. Solutions retenues pour implémentation future (ordre proposé)

| # | Finding | Effort | Risque | Bénéfice |
|---|---|---|---|---|
| 1 | A (pending : payer/annuler) | M | Faible (API prête) | Élevé — argent bloqué/booking perdu |
| 2 | B (devise € dur) | S | Faible | Élevé — véracité du paiement |
| 3 | E (avis doublon) | S | Faible | Moyen — UX |
| 4 | C (totaux multi-devises) | M | Faible | Moyen |
| 5 | D (i18n + sélecteur) | L (par étapes) | Faible | Élevé — promesse « langue » |
| 6 | G (smoke wishlist) | XS | Nul | Fiabilité smoke |

*Toutes les solutions sont **additives** ou remplacement local d'affichage :
aucune signature d'API publique retirée, aucun schéma DB modifié, aucun flux
de données existant cassé. Chaque implémentation sera accompagnée de ses
tests + smoke + build + ai:check (règles §13/§16 du framework).*
