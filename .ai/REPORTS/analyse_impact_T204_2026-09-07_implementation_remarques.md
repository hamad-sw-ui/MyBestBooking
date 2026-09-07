# Analyse d'impact — T-204 : mise en œuvre des remarques de l'audit e-mails (sans régression)

- **Date** : 2026-09-07
- **Tâche** : T-204 — implémenter les remarques restantes de l'audit d'intégralité + e-mails
- **Référent** : `.ai/REPORTS/validation_T-203_2026-09-07_correction_paiement_manuel.md`

## Contexte

L'audit d'intégralité du site (T-203, committé `aaa35e9`) avait livré deux commentaires
ouverts, jugés « inoffensifs » mais non résolus :

1. **P3 — machinerie Stripe orpheline** dans `reservation-form.tsx` :
   `StripePaymentForm`, `pendingStripePayment`, branche `handleSubmit` Stripe. Elle
   n'était plus atteignable par le flux manuel, mais aucun garde ne l'interdisait
   *formellement* si le serveur renvoyait un `payment` malgré `manualConfirmation:true`.
2. **E-mails non re-testés au runtime post-correctif** : `e-mail d'annulation` et
   `price-alert` étaient couverts par des tests de logique, mais l'envoi réel
   (outbox → mailer console) n'avait pas été prouvé lors de l'audit.

## Périmètre de l'impact

| Zone | Fichier(s) concernés | Nature du changement |
|---|---|---|
| Flux de réservation (UI) | `src/app/(main)/reservation/reservation-form.tsx` | Remplacement d'une condition inline par un garde dédié (décision extraite) |
| Décision de flux (nouveau) | `src/lib/booking-flow.ts` (nouveau) | Helper pur `shouldShowStripeForm` (testable) |
| Test de la décision | `src/lib/booking-flow.test.ts` (nouveau) | 5 cas couvrant le flux manuel n'affiche jamais l'UI carte |
| Preuve e-mail annulation | `src/lib/booking-cancellation-mail.test.ts` | Déjà existant ; re-exécuté → mail console réel (voyageur fr + hôte en) |
| Preuve e-mail price-alert | `src/lib/price-alert-mail.test.ts` (nouveau) | E-mail price-alert envoyé réellement, localisé fr, idempotent |

## Impacts positifs

- **Risque résiduel P3 neutralisé** : même si le serveur régresse et renvoyait un
  `payment` pour un booking manuel, l'UI n'affiche jamais l'écran Stripe.
- **Décision testable** : `shouldShowStripeForm` est une fonction pure couverte par
  5 tests unitaires (aucun besoin de composer le serveur).
- **Preuves runtime réelles** : annulation (2 e-mails : voyageur fr + hôte en,
  eventKeys distincts) et price-alert (e-mail fr, idempotence via eventKey unique).
- **Zéro régression fonctionnelle** : le flux manuel (paiement sur place) et le flux
  en ligne (Stripe) restent strictement identiques pour l'utilisateur ; seul le cas
  « abnormal » (manuel + payment renvoyé) change, en le rendant sûr.

## Impacts neutres / hors périmètre

- **Aucune suppression de la machinerie Stripe** : elle reste dans le code (back-office
  `/api/bookings/[id]/payment`), mais est désormais *inatteignable et prouvée*.
  La décision de la supprimer reste hors périmètre (non demandée).
- **Aucun changement de schéma DB** : pas de migration.
- **Aucun routage / page supprimés** : 64 pages conservées.

## Risques

- **Régression dans le guard narrowing** : `data.payment.clientSecret` est lu dans la
  branche `shouldShowStripeForm(data)`. Le helper garantit que `clientSecret` existe
  quand il retourne `true` ; `tsc` valide (0 erreur). Vérifié par les tests.
- **Faux positifs de skip en CI** : les tests serveur-live (`admin/bulk`, `admin/hosts`)
  skippent sans serveur. Re-testés avec le serveur actif : **17/17 passent** → aucune
  régression de couverture (total réel **554 tests**).
