# Audit runtime profond — T-207 — Suppression des parcours de paiement plateforme

- **Date** : 2026-09-10
- **Demande utilisateur** : analyser profondément les pages, boutons, fonctionnalités et parcours à l'exécution, expliquer chaque problème, proposer une solution sans régression, et retirer tout élément menant au paiement car la plateforme doit uniquement proposer des réservations sans paiement en ligne.
- **Méthode** : inspection des parcours et sources runtime (pages publiques, tunnel réservation, réservations, compte, aide, légal/RGPD, dashboard billing/admin, APIs booking/payment/provider, scripts smoke/simulations) + validations TypeScript intermédiaires.

## Synthèse

Le produit avait déjà évolué vers une confirmation hôte/manuelle, mais plusieurs restes du modèle antérieur continuaient à exposer ou permettre un paiement plateforme : choix "payer en ligne", Stripe form, reprise `/reservation?booking=...`, endpoint `/api/bookings/[id]/payment`, clé publique Stripe, wallet consommable, CTA "Payer maintenant", wording légal/aide/facture et bloc pro de versement. Ces éléments étaient contradictoires avec la nouvelle contrainte produit.

## Findings, problèmes et solutions

| ID | Zone runtime | Problème constaté | Solution sans régression |
|---|---|---|---|
| F1 | Tunnel `/reservation` | Le formulaire pouvait encore proposer un paiement en ligne, afficher Stripe et reprendre un booking via query param pour récupérer un paiement. | Transformer l'étape finale en demande sans paiement : plus de choix online/manual, plus de Stripe UI, plus de reprise payment, conservation des coordonnées invité/compte et du devis. |
| F2 | Client booking | Des payloads pouvaient encore inclure `payOnline:true` et `useWalletCredits:true`. | Ne plus envoyer ces champs depuis le client ; côté serveur, les ignorer pour couvrir les clients forgés/legacy. |
| F3 | `POST /api/bookings` | Même si l'UI est corrigée, un client forgé pouvait demander un payment intent ou un débit wallet. | Défense serveur : aucun intent PSP, `payment:null`, `manualConfirmation:true`, `onlinePaymentDisabled:true`, `walletCreditsUsed=0`, pas de débit wallet. |
| F4 | `/api/bookings/[id]/payment` | La route de reprise pouvait recréer ou renvoyer un paiement après une réservation pending. | Route legacy neutralisée : auth/propriété conservées, propriétaire → `410 ONLINE_PAYMENT_DISABLED`, non-propriétaire → `403`. |
| F5 | UI réservations | Le bouton "Payer maintenant" conduisait explicitement vers `/reservation?booking=...`. | Retirer le CTA ; conserver les actions utiles (voir, annuler, confirmer/constater hors plateforme selon rôle). |
| F6 | Stripe navigateur | `/api/providers/stripe` et `StripePaymentForm` gardaient une surface de formulaire carte. | Ne plus exposer de clé publique ; stub du composant Stripe sans Stripe.js/Elements ; helper `shouldShowStripeForm()` toujours `false`. |
| F7 | Confirmation hôte legacy | Les anciens bookings avec intent non payé pouvaient être bloqués par la garde "online unpaid". | À la confirmation hôte/admin, neutraliser les champs PSP legacy non payés puis confirmer en flux manuel. |
| F8 | Wallet | Le wallet pouvait être présenté comme moyen de paiement ou être débité dans le tunnel. | Wallet conservé informatif/récompense ; wording adapté ; `useWalletCredits` n'a plus d'effet transactionnel. |
| F9 | Aide, compte, textes devis/facture | Plusieurs libellés parlaient de checkout, paiement, carte ou remboursement plateforme. | Remplacer par demande transmise, montant de référence/estimatif, règlement hors plateforme et absence de données carte dans le tunnel. |
| F10 | Pages légales/RGPD | Les pages mentionnaient Stripe, paiement en ligne, carte bancaire et sous-traitant paiement. | Aligner : pas de paiement en ligne dans MyBestBooking, pas de données carte collectées dans le tunnel, réservation = dates/montant estimé/statut. |
| F11 | Dashboard billing/payout | La carte "demander un versement" et le setup de compte de versement suggéraient un encaissement plateforme actif. | Remplacer la carte par un avis : versements plateforme désactivés, montants informatifs tant que les réservations ne sont pas encaissées par MyBestBooking. |
| F12 | Settings admin provider | La configuration Stripe restait visible comme provider de paiement. | Masquer Stripe dans la liste admin et afficher un avis que le paiement en ligne est désactivé. |
| F13 | Scripts QA | Les simulations héritées attendaient parfois un débit wallet ou des marqueurs checkout. | Adapter les attentes au wallet informatif et au tunnel sans paiement plateforme. |

## Éléments explicitement préservés

- Recherche et filtres.
- Fiches hébergement, disponibilité, devis et prix localisés.
- Création de réservation manuelle/pending.
- Confirmation hôte/admin, annulation, messagerie, comptes invités.
- Règles host approval/admin et RBAC.
- Exports/factures historiques, avec wording de trace/référence et non de paiement plateforme.
- Routes/webhooks legacy non exposés au voyageur, conservés pour compatibilité technique.

## Preuves intermédiaires avant validations finales

- 🔨 `npx tsc --noEmit --pretty false --incremental false` vert après ajout des clés i18n T-207.
- 🔨 `npx tsc --noEmit --pretty false --incremental false` vert après retrait CTA paiement réservation.
- 🔨 `npx tsc --noEmit --pretty false --incremental false` vert après défense `POST /api/bookings`.
- 🔨 `npx tsc --noEmit --pretty false --incremental false` vert après neutralisation confirmation legacy.
- 🔨 `npx tsc --noEmit --pretty false --incremental false` vert après alignement légal/RGPD.
- 🔨 `npx tsc --noEmit --pretty false --incremental false` vert après alignement `ui-strings`, billing payout désactivé et settings Stripe masqué.

## Validation finale attendue

Voir `.ai/REPORTS/validation_T207_2026-09-10_sans_paiement_plateforme.md` après exécution de la chaîne complète.
