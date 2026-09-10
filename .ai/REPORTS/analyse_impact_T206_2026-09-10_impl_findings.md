# Analyse d'impact — T-206 — Implémentation des remarques de l'audit fonctionnel profond n°31

**Date** : 2026-09-10  
**Niveau retenu** : **C — Critique**  
**Justification** : la correction touche des calculs financiers (`POST /api/bookings`, devis, promotions, wallet), le cycle de vie paiement/fidélité, des gardes de publication, des écritures API sous maintenance et des contrôles d'accès/obligations compte.

---

## 1. Fichiers utilisant directement les composants concernés

Commandes exécutées :

```bash
grep -R "export async function \(POST\|PUT\|PATCH\|DELETE\)" -n src/app/api
grep -R "POST /api/bookings\|confirmed\|manualConfirmation\|mon-compte\|account-client\|read_page_bundle" -n scripts/simulate.py scripts/deep_sim.py
grep -R "validStay\|searchFilterWarnings\|amenity\|displayCurrency" -n src/app/(main)/recherche/page.tsx src/app/api/properties/route.ts src/lib/search-warnings.ts
grep -R "DELETE /api/users/me\|deletedAt\|bookings" -n src/app/api/users/me src/lib/auth.ts src/db/schema.ts
grep -R "PropertyBookingCard" -n src/app/(main)/hebergement/[slug]/page.tsx src/components/property-booking-card.tsx
```

Fichiers directement concernés :

- `src/app/api/bookings/route.ts` : création booking, calcul totaux, promo, BestRewards, wallet, liste bookings.
- `src/app/api/bookings/quote/route.ts` : devis checkout, référence métier à conserver.
- `src/app/api/bookings/[id]/route.ts` : transitions booking, paiement sur place, fidélité, emails.
- `src/lib/booking-lifecycle.ts` : règles de transition.
- `src/app/api/properties/[id]/route.ts`, `src/app/api/properties/[id]/validate/route.ts`, `src/lib/host-approval.ts` : publication/gate hôte.
- `src/app/api/properties/route.ts`, `src/app/(main)/recherche/page.tsx`, `src/lib/search-warnings.ts` : recherche/catalogue.
- `src/app/page.tsx`, `src/components/property-booking-card.tsx`, `src/app/(main)/hebergement/[slug]/page.tsx` : dates/UX capacité.
- `src/app/api/rooms/route.ts`, `src/app/api/rooms/[id]/route.ts`, `src/app/api/messages/route.ts` : robustesse UUID et maintenance.
- `src/app/api/price-alerts/route.ts`, `src/app/api/price-alerts/[id]/route.ts`, `src/app/api/wishlists/route.ts`, `src/app/api/conversations/route.ts`, `src/app/api/users/me/route.ts` : mutations non-admin à bloquer en maintenance.
- `src/app/(main)/messages/page.tsx`, `src/app/dashboard/messages/page.tsx`, `src/components/layout/dashboard-sidebar.tsx`, `src/components/layout/dashboard-mobile-header.tsx` : messagerie vide/admin.
- `src/lib/invoice.ts`, `src/app/api/bookings/[id]/invoice/route.ts`, `src/components/booking-row-actions.tsx` : document facture/reçu.
- `scripts/simulate.py`, `scripts/deep_sim.py` : harnais QA obsolètes.

---

## 2. Composants indirectement impactés

- Pages publiques : accueil, recherche, fiche hébergement, réservation.
- Pages voyageur : mes réservations, messages, mon compte, favoris/alertes.
- Dashboards hôte/admin : propriétés, chambres, bookings, messages, billing/payouts, reviews.
- Jobs/cron : expiration des bookings online pending, completion automatique des séjours payés, price-alerts.
- E-mails/outbox : confirmations booking, messages, guest claim, rappels, avis.
- Exports et analytics : utilisent `discount`, `paymentStatus`, `status`, `commissionAmount`, `netToHost`.

---

## 3. ViewModel impactés

Non applicable techniquement (Next.js/React, pas de ViewModel Android). Équivalents côté client :

- `ReservationForm` : récap prix, paiement manuel/en ligne, wallet.
- `PropertyBookingCard` : dates et capacité enfants.
- `BookingRowActions` : boutons confirmer, payé sur place, clôturer, annuler, facture/reçu.
- `MessagesManager`, `MessageComposer`, `ContactHostButton` indirectement.

---

## 4. Écrans impactés

- `/`, `/recherche`, `/hebergement/[slug]`, `/reservation`
- `/mes-reservations`, `/messages`, `/messages/[id]`, `/mon-compte`
- `/dashboard/properties`, `/dashboard/properties/[id]`, `/dashboard/rooms`, `/dashboard/bookings`, `/dashboard/messages`, `/dashboard/settings`, `/dashboard/billing`
- Documents `/api/bookings/[id]/invoice`

---

## 5. Workers / Services impactés

- `src/app/api/cron/price-alerts/route.ts` indirectement : doit rester cohérent avec les transitions payées/completed.
- `src/lib/payment-intents.ts` / `src/lib/payment-events.ts` : non modifiés sauf validation non-régression de `payOnline`.
- `src/lib/email-outbox.ts` : non modifié, mais doit continuer à envoyer les confirmations/messages.
- `scripts/run_all_sims.py`, `scripts/simulate.py`, `scripts/deep_sim.py` : outils QA.

---

## 6. Tests existants couvrant la fonctionnalité

- `src/app/api/bookings/quote/route.test.ts`
- `src/app/api/bookings/[id]/route.test.ts`
- `src/app/api/bookings/[id]/payment/route.test.ts`
- `src/app/api/bookings/route.test.ts`
- `src/lib/booking-lifecycle.test.ts`
- `src/lib/promotions.test.ts`, `src/lib/wallet-currency.test.ts`, `src/lib/loyalty.test.ts`
- `src/app/api/properties/[id]/validate/route.test.ts` si présent / couverture via sims.
- `src/app/api/messages/route.test.ts`
- `src/app/api/users/me/route.test.ts`
- `src/lib/room-remaining.test.ts`, `src/lib/search-warnings.test.ts` si présent.
- Harnais : `npm run smoke`, `scripts/run_all_sims.py`, `scripts/site-audit.mjs`.

---

## 7. Nouveaux tests à créer ou adapter

- Booking financier : invité + rate plan + promo → même total que devis + promo, pas de BestRewards invité ; `discount` = ratePlan + promo.
- Booking lifecycle : online pending non confirmé par hôte ; completed exige `paymentStatus='paid'`; manuel pending peut être confirmé puis marqué payé sur place.
- Publication : admin ne peut pas activer un bien d'hôte `pending/rejected` via `PUT`.
- Maintenance : `POST /api/price-alerts`, `POST /api/messages`, `PATCH /api/users/me`, `POST /api/properties`, `POST /api/rooms` → 503 non-admin.
- UUID : property/room delete, bookings/rooms/messages query invalides → 400.
- Recherche/API : dates passées → 0 résultat ; API `amenity=tv`/`amenities=tv` alignée ; API `displayCurrency=XAF` alignée.
- PropertyBookingCard : limite enfants selon `maxChildren` et `maxOccupancy`.
- Users delete : obligations actives → 409, compte sans obligations → OK.
- Simulations : attentes `pending/manualConfirmation`, bundle `account-client.tsx`.

---

## 8. Risques de régression

- **Finance** : modifier l'ordre d'application des remises peut changer les montants ; mitigation : ordre T-205 conservé, tests chiffrés.
- **Paiement manuel** : risque de bloquer à tort le flux voulu ; mitigation : autoriser explicitement manual `paymentIntentId=NULL` puis action `markPaidOffline` avant completion.
- **Paiement en ligne** : risque de casser Stripe/mock ; mitigation : ne pas modifier `createPaymentIntentForBooking`, seulement refuser une confirmation manuelle si non payé.
- **Maintenance** : risque de bloquer admin/support ; mitigation : `assertNotMaintenance` bypass admin conservé.
- **Recherche** : changer dates passées peut modifier les résultats ; mitigation : seulement pour dates impossibles, checkout refusait déjà.
- **Messagerie** : masquer conversations vides peut cacher le fil juste créé ; mitigation : les pages détail restent accessibles, seules les listes générales excluent les fils sans message.
- **Suppression compte** : blocage plus strict ; mitigation : message 409 actionnable, suppression sans obligation inchangée.

---

## 9. Composants à revérifier après correction

- `npm run typecheck`
- `npm run lint`
- Tests ciblés nouveaux/modifiés : bookings, quote, properties, rooms, messages, users/me, search warnings.
- `npm test`
- `npm run i18n:check`
- `npm run build`
- `npm run smoke`
- `python3 scripts/run_all_sims.py`
- `npm run site:audit -- http://127.0.0.1:3000`
- `npm run ai:check`

---

## Décision

On implémente en petits lots additifs, sans migration DB et sans suppression de contrat public. Les guards sont renforcés côté serveur, l'UI est alignée pour éviter des parcours contradictoires, et les scripts de validation sont remis au contrat T-205/T-206.
