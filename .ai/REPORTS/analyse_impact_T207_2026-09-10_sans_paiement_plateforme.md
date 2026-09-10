# Analyse d'impact — T-207 — Réservations sans paiement plateforme

- **Date** : 2026-09-10
- **Niveau** : C
- **Demande** : analyser les scénarios runtime (pages, boutons, fonctionnalités, parcours), expliquer les problèmes et solutions, puis retirer les éléments qui conduisent un voyageur à payer dans la plateforme. MyBestBooking doit proposer uniquement des demandes/réservations sans paiement en ligne.

## Périmètre impacté

### Surfaces voyageur

- `/reservation` : étape de finalisation, choix en ligne/manuel, reprise de paiement, wallet, Stripe Elements.
- `/mes-reservations` et lignes de réservation : actions de reprise/paiement.
- `/mon-compte`, aide, textes prix/devise/facture : wording qui promettait paiement, checkout ou carte.
- Pages légales et confidentialité : mentions Stripe/carte/sous-traitant paiement.

### Défense serveur

- `POST /api/bookings` : ne doit plus créer d'intent PSP, ni consommer le wallet, même si un client forge `payOnline:true` ou `useWalletCredits:true`.
- `/api/bookings/[id]/payment` : ancien endpoint de reprise doit être neutralisé après contrôle auth/propriété.
- `/api/providers/stripe` : ne doit plus exposer de clé publique au navigateur.
- Confirmation hôte/admin : doit rester possible sur des réservations sans PSP et neutraliser les champs d'anciens intents non payés.

### Surfaces hôte/admin/finance

- Dashboard billing/payout : éviter un bouton ou un setup qui ferait croire à un encaissement/versement plateforme actif alors que les réservations ne sont pas encaissées en ligne.
- Settings admin : masquer la configuration Stripe comme provider de paiement voyageur.
- Webhooks/cron/routes PSP legacy : conservables comme compatibilité technique si non accessibles depuis le parcours voyageur, mais ne doivent plus recréer d'entrée de paiement côté client.

## Risques de régression identifiés

| Risque | Impact | Garde-fou retenu |
|---|---|---|
| Casser la recherche, fiches, devis/disponibilité | Parcours public principal inutilisable | Ne pas modifier les APIs de recherche/devis ; réserver la refonte à la dernière étape `/reservation` et aux textes. |
| Casser la création de réservation manuelle | Plus aucune réservation possible | `POST /api/bookings` conserve le calcul, les promos/rate plans, la disponibilité et renvoie `201 pending manualConfirmation`. |
| Réouvrir un paiement par client forgé | Non-conformité à la demande utilisateur | Ignorer `payOnline`, forcer `payment:null`, ajouter route payment `410 ONLINE_PAYMENT_DISABLED`, stub `StripePaymentForm`. |
| Débiter le wallet malgré l'absence de paiement plateforme | Effet financier inattendu | Wallet conservé informatif ; `walletCreditsUsed=0`, pas de `wallet_balance` décrémenté. |
| Bloquer la confirmation hôte d'anciens bookings avec intent impayé | Données legacy bloquées | À la confirmation, neutraliser les champs PSP non payés au lieu de refuser. |
| Laisser une UI admin/pro qui vend Stripe ou les versements | Incohérence produit | Masquer Stripe dans settings admin et remplacer le bloc versements par un avis informatif. |
| Casser les tests/simulations hérités du paiement/wallet | QA faussement rouge | Adapter les attentes QA au wallet informatif et au tunnel sans paiement. |

## Décision produit

- Le parcours voyageur devient : recherche → fiche → disponibilité/devis → formulaire invité/compte → demande envoyée à l'hôte, sans carte ni paiement dans MyBestBooking.
- Le wallet reste visible comme solde/récompense informatif ; il n'est plus appliqué au total de réservation.
- Les statuts `paymentStatus` et routes historiques restent en base pour compatibilité/admin/legacy, mais aucune action voyageur ne doit initier ou reprendre un paiement plateforme.
- Les paiements/règlements sont décrits comme effectués hors plateforme avec l'hôte, sans promesse d'encaissement MyBestBooking.

## Fichiers principaux à modifier

- `src/app/(main)/reservation/reservation-form.tsx`
- `src/app/api/bookings/route.ts`
- `src/app/api/bookings/[id]/payment/route.ts`
- `src/app/api/bookings/[id]/route.ts`
- `src/app/api/providers/stripe/route.ts`
- `src/components/stripe-payment-form.tsx`
- `src/components/booking-row-actions.tsx`
- `src/app/dashboard/billing/page.tsx`
- `src/components/admin/settings-panel.tsx`
- `src/lib/booking-flow.ts`, tests associés
- `src/lib/ui-strings.ts`, pages aide/légal/RGPD/compte
- `scripts/deep_sim.py`, `scripts/paranoid_sim.py`

## Niveau de validation attendu

- TypeScript, lint, i18n.
- Tests ciblés : booking route, route payment désactivée, confirmation legacy, helper `booking-flow`, ui-strings.
- Tests globaux : `npm test`, build, smoke, site audit, simulations si serveur disponible.
- Gouvernance : `.ai` synchronisé, `npm run ai:check`, `git diff --check`.
