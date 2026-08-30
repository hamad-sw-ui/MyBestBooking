# Analyse d'impact — T-152 (implémentation des findings A→E + G de l'audit n°24)

- **Date** : 2026-08-30
- **Tâche** : T-152 — implémentation sans régression des remarques de
  l'audit fonctionnel n°24 (A pending payer/annuler · B devise € codée en
  dur /reservation · C totaux analytics/billing sans devise · D i18n
  sélecteur + `<html lang>` · E avis doublon + état · G smoke wishlist).
- **Niveau** : **S — Structurant**. Justification :
  - changement de **format de réponse publique** (champs **additifs**
    `review` sur `GET /api/bookings` → table §15.0 « signature publique /
    format » = analyse complète + conception) ;
  - **nouveaux composants UI** (LanguageSelector, CTA payer, écran d'état
    d'avis) ;
  - **pas** C : aucun schéma DB modifié, aucune migration, aucune écriture
    financière ni conversion de montant (B/C corrigent uniquement
    l'**affichage** avec la devise déjà stockée), pas de sécurité.
  - Précédents alignés : T-132 (devise d'affichage XAF) et T-133 (filtre de
    prix = correction d'affichage financier) implémentés sans niveau C.
- **Surface impactée** : 4 pages RSC/client (`mes-reservations`,
  `reservation`, `dashboard/analytics`, `dashboard/billing`), 1 route API
  (GET `/api/bookings`), 1 composant partagé (`BookingRowActions`, header),
  2 libs (`ui-strings`, `use-display-currency`), layout racine, smoke.
- **Risques** : Faible (aucune régression attendue sur les flux existants ;
  EUR reste le cas réel → rendus identiques).
- **Preuves attendues** : tsc 0 · lint 0 · vitest augmenté (unitaires +
  intégration) · smoke OK · build OK · ai:check OK · preuves runtime HTTP.
- **Plan de non-régression** : contrats inchangés (POST bookings, register,
  reviews GET/POST) ; champs RETURNED uniquement additifs ; smoke seed
  conservé ; vérification `git diff --stat` et tests ciblés.

---

## 1. Quels fichiers utilisent directement le composant concerné ?

Commandes (faits, pas mémoire) :

- `grep -rln "formatPrice" src/app src/components --include="*.tsx"` →
  ~40 fichiers. Les montants **transactionnels** (facture, mes-réservations,
  wallet) passent déjà `booking.currency`. Seuls `reservation/page.tsx`
  (5+ occurrences `€{...}` sans devise), `dashboard/analytics/page.tsx`
  (l.191/205/277/308) et `dashboard/billing/page.tsx` (l.166/180/194/238)
  appellent `formatPrice(somme)` **sans** devise.
- `grep -rn "getCurrentUser\|useDisplayPreferences" src/app/layout.tsx
  src/components/layout/header.tsx src/lib/server-locale.ts` → layout
  (user), header (client), `getServerLocale` (RSC) : 3 endroits où la
  langue est résolue ; `<html lang="fr">` figé (`src/app/layout.tsx` l.58).
- `grep -rn "BookingRowActions" src` → 1 seul appelant :
  `(main)/mes-reservations/page.tsx` (2 rendus : à venir + passées via le
  même composant ? Non — seulement la section « À venir »).
- `GET /api/bookings` : appelé par `(main)/mes-reservations` ? Non — la page
  RSC interroge la DB directement. La route API est consommée par
  `dashboard/messages`, smoke, et les appels externes ; champs **ajoutés**
  uniquement.
- `GET /api/bookings/[id]` : consommé par `reservation/page.tsx`
  (`waitForStripeConfirmation`, l.~272) et par la page d'édition/autres.

## 2. Quels composants l'utilisent indirectement ?

- `formatPrice` → déjà centralisé dans `src/lib/utils.ts` ; aucun impact.
- `useDisplayPreferences` → header, cartes recherche/fiche, profil, etc.
  L'ajout d'une source « localStorage anonyme » ne touche que la résolution
  quand **aucun** utilisateur connecté n'a de langue valide.
- `BookingRowActions` → seulement `mes-reservations` (page RSC).
- `ui-strings` (`makeT`) → 20 composants ; ajout de clés **additif** (le
  type `UiStringKey = keyof typeof FR` exige d'ajouter chaque clé dans FR
  **et** EN — vérifié l.273-275 ; un oubli casse la compilation → garde
  statique gratuite).

## 3. Quels ViewModel seront impactés ?

Sans objet (pas de ViewModel côté Kotlin ; Next.js App Router).

## 4. Quels écrans seront impactés ?

- `/mes-reservations` (+ `/mes-reservations/avis/[id]`) — finding A/E.
- `/reservation?booking={id}` (nouveau chemin de reprise) + recap — A/B.
- `/dashboard/analytics`, `/dashboard/billing` — C (affichage uniquement).
- Header (toutes pages) + layout racine — D.
- Aucun écran admin/messagerie/modération modifié.

## 5. Quels Workers ou Services seront impactés ?

- **Aucun worker/cron modifié** : `expirePendingBookings` (cron
  price-alerts) reste la borne de sûreté ; le bouton « Payer maintenant »
  ne crée **jamais** de réservation (POST `/api/bookings/[id]/payment` =
  reprise propriétaire, vérifié `payment-intents.ts`
  `resumePaymentIntentForBooking`).
- Outbox/e-mails : aucun changement ; le rejeu de paiement confirmé passe
  par `sendBookingConfirmationIfNeeded` (idempotent, `confirmationEmailSentAt`).

## 6. Quels tests existants couvrent déjà cette fonctionnalité ?

- `src/app/api/bookings/route.test.ts` — POST disponibilité (13.5, DB).
- `src/lib/booking-lifecycle.test.ts` — transitions (pending→confirmed/
  cancelled déjà autorisées).
- `src/lib/booking-cancellation-mail.test.ts`, `booking-rules.test.ts`.
- `src/lib/ui-strings.test.ts` (4 cas) — couvre le dictionnaire FR/EN.
- Aucun test n'existe pour `resumePaymentIntentForBooking` ni pour le
  formatage multi-devise (`grep` vide) → nouveaux tests nécessaires.

## 7. Quels nouveaux tests devront être créés ?

1. `src/lib/currency-summary.test.ts` — unitaire : agrégation par devise,
   formatage 1 devise / devises mixtes, cas vide.
2. `src/app/api/bookings/[id]/payment/route.test.ts` — intégration DB :
   booking `pending` + `paymentExpiresAt` futur → POST payment 200
   (`requiresConfirmation` selon mock) ; booking non-reprenable → 409/404 ;
   non-propriétaire → 403. `getCurrentUser` mocké (pattern
   `register/route.test.ts`).
3. `src/app/api/bookings/route.test.ts` (extension) — GET renvoie les champs
   additifs `review.id`/`review.status` pour une résa commentée et
   `review: null` sinon (aucun appelant cassé).
4. `src/lib/ui-strings.test.ts` (extension) — nouvelles clés FR/EN
   présentes et non vides (garde de type déjà statique).
5. Smoke : wishlist auto-créée si absente (G) — assertion ajoutée ;
   `@assertions` recompé.

## 8. Quels risques de régression existent ?

| Risque | Mitigation |
|---|---|
| Changement de forme `GET /api/bookings` | Champs **additifs** (`review: {id,status,overallRating} | null`) ; aucun champ retiré ; test d'intégration |
| `reservation?booking=` : pré-remplissage différent du montant stocké | C'est le **montant stocké** (booking.total) qui est facturé ; le récapitulatif reste indicatif (déjà le cas en checkout direct). Ne jamais modifier le total envoyé au PSP |
| Reprise auto : double intent | `resumePaymentIntentForBooking` idempotent (`paymentIntentId` retrouvé via la référence, `for update`) ; garde status/paymentStatus |
| Annulation `pending` : frais/remboursement | `GET /api/bookings/[id]/cancellation` accepte `pending` (vérifié l.30) et `cancelBooking` aussi (l.30/42) — API prête |
| Multi-devises graphique | Les barres ne mélangent plus les devises : série = devise principale, note explicite si devises mixtes |
| i18n : régression de la langue | Défaut **fr** inchangé ; sélecteur PATCH `PATCH /api/users/me` (déjà supporté, schéma validé `isUiLocale`) ; `<html lang>` suit `getServerLocale()` (identique à l'ancien « fr » si fr) |
| Smoke : wishlist auto | La création utilise `POST /api/wishlists {name}` déjà en place ; jamais de suppression de données seed |
| Hydratation `<html lang>` | `suppressHydrationWarning` déjà présent sur `<html>` (layout) ; script beforeInteractive idempotent |

## 9. Quels composants devront être revérifiés après la modification ?

- Tous les tests (§6 + §7), `npm run typecheck`, `npm run lint`,
  `npm test`, `npm run smoke`, `npm run build`, `npm run ai:check`.
- Runtime : parcours complet `pending → Payer maintenant → confirmé`
  (mock provider), e-mail de confirmation (outbox), page avis déjà-donnée,
  sélecteur de langue (anonyme + connecté), analytics/billing (rendus
  EUR identiques), recherche/fiche (non-régression devises).
