# Analyse d'impact T-210 — Audit runtime complémentaire + filtre accueil simplifié

- **Date** : 2026-09-10
- **Branche** : `arena/01a08747-mybestbooking`
- **Niveau** : S — audit fonctionnel transverse + modification UI publique localisée
- **Auteur** : Agent Arena.ai

## Demande

Nouvel audit fonctionnel profond des scénarios/pages/boutons/fonctionnalités et correction explicite : retirer du filtre de la page d'accueil les demandes de date d'arrivée, date de départ et nombre de voyageurs.

## 1. Quels fichiers utilisent directement le composant concerné ?

Commandes :

```bash
rg -n "checkIn|checkOut|guests|home-guests|action=\"/recherche\"" src/app/page.tsx 'src/app/(main)/recherche/page.tsx' src/components/property-booking-card.tsx 'src/app/(main)/reservation/reservation-form.tsx'
```

Surfaces directes :

- `src/app/page.tsx` : formulaire hero de la page d'accueil, surface à modifier.
- `src/app/(main)/recherche/page.tsx` : formulaire avancé qui doit rester complet.
- `src/components/property-booking-card.tsx` : dates/adultes/enfants utiles à la disponibilité avant le tunnel.
- `src/app/(main)/reservation/reservation-form.tsx` : dates/chambre/voyageurs requis pour créer une demande.

## 2. Quels composants l'utilisent indirectement ?

- `PropertyCard` reçoit `searchQuery` depuis `/recherche` pour préserver les dates vers les fiches.
- `buildReservationUrl` propage dates/voyageurs depuis la fiche vers `/reservation`.
- `evaluateBookingRules` reste l'autorité disponibilité/prix côté serveur et ne dépend pas du formulaire d'accueil.

La suppression est donc limitée au point d'entrée marketing ; elle ne retire aucune donnée du parcours de réservation.

## 3. Quels ViewModel seront impactés ?

Sans objet sur MyBestBooking (Next.js/React). Aucun équivalent d'état global ou store partagé n'est modifié.

## 4. Quels écrans seront impactés ?

- Impact direct : `/` — formulaire hero simplifié.
- Non impactés mais à revérifier : `/recherche`, `/hebergement/[slug]`, `/reservation`, `/mes-reservations`, `/dashboard/*`.

## 5. Quels Workers ou Services seront impactés ?

Aucun service métier n'est modifié. Les crons `price-alerts` et `payouts`, l'outbox mail, les API booking/search et la DB ne changent pas.

## 6. Quels tests existants couvrent déjà cette fonctionnalité ?

- `npm run smoke` couvre `/`, `/recherche`, fiche hébergement et création booking.
- `npm run site:audit` couvre les pages publiques/protégées multi-profils.
- `scripts/run_all_sims.py` couvre smoke/surface/deep/xtreme/paranoid.
- Les tests réservation/recherche/disponibilité existants couvrent les surfaces avancées où dates/voyageurs restent nécessaires.

## 7. Quels nouveaux tests devront être créés ?

Ajout prévu et livré : `src/app/page.home-filter.test.ts`.

Contrat verrouillé :

- absence de `name="checkIn"`, `name="checkOut"`, `name="guests"`, `id="home-guests"` dans `src/app/page.tsx` ;
- présence de `action="/recherche"` et `name="city"`.

## 8. Quels risques de régression existent ?

| Risque | Parade sans régression |
|---|---|
| Perdre la capacité à rechercher par dates depuis l'accueil | Ne retirer que le formulaire hero ; `/recherche` reste l'écran avancé pour affiner dates/voyageurs. |
| Casser le passage de contexte vers la fiche | Ne pas modifier `PropertyCard`, `stayQuery` ni `buildReservationUrl`. |
| Casser la disponibilité/réservation | Ne pas modifier `evaluateBookingRules`, `/api/bookings`, `/api/bookings/quote`, `PropertyBookingCard`, ni `/reservation`. |
| Réintroduire un paiement plateforme | Aucun fichier paiement/Stripe n'est touché par T-210 ; les garde-fous T-207 restent testés. |
| Supprimer des clés i18n encore utiles ailleurs | Aucune clé i18n supprimée. Les libellés dates/voyageurs restent utilisés sur `/recherche`, fiche et tunnel. |

## 9. Quels composants devront être revérifiés après la modification ?

- `src/app/page.tsx` : contrat du formulaire hero.
- `src/app/(main)/recherche/page.tsx` : filtres avancés encore présents.
- `src/components/property-booking-card.tsx` et `/reservation` : dates/voyageurs conservés.
- Garde T-207 : absence de CTA paiement voyageur.
- QA : typecheck, lint, tests ciblés, Vitest global, build, smoke, simulations, site-audit, ai:check, `git diff --check`.

## Conclusion d'impact

La correction est volontairement **locale** : elle réduit la friction du point d'entrée `/` sans retirer les filtres avancés ni les contrôles métier. Les autres constats de l'audit T-210 sont documentés dans le rapport dédié ; seuls les risques sans urgence produit sont proposés en suite éventuelle.
