# Analyse de conception — T-204 : mise en œuvre des remarques (garde P3 + preuves e-mails)

- **Date** : 2026-09-07
- **Tâche** : T-204

## Problème

Le flux de réservation ne vérifiait pas *explicitement* l'absence de paiement en ligne
pour un booking manuel. Deux preuves runtime (annulation, price-alert) manquaient à
l'audit malgré une couverture par tests de logique.

## Choix de conception

### 1. Garde UI extrait et testable : `shouldShowStripeForm`

Plutôt que d'empiler une condition dans le formulaire, on extrait la décision dans un
helper pur `src/lib/booking-flow.ts` :

```ts
export function shouldShowStripeForm(result: BookingSubmitResult): boolean {
  if (result.manualConfirmation) return false;      // priorité au flux manuel
  return Boolean(result.payment?.requiresConfirmation && result.payment.clientSecret);
}
```

**Justification** :
- **Priorité manuel avant tout** : une réponse `manualConfirmation:true` ne peut
  jamais aboutir à l'UI carte, même si `payment` est présent (cas « serveur
  corrompu »). C'est la défense en profondeur.
- **Pur et testable** : aucun I/O réseau ; 5 tests unitaires couvrent les cas clés
  (en ligne → true ; succeeded → false ; manuel + payment présent → false ;
  manuel seul → false ; sans clientSecret → false).
- **Réutilisation** : appliqué aux deux points d'entrée du tunnel (`handleSubmit`
  et `resumePaymentFor`), donc comportement cohérent création/reprise.

### 2. Preuves e-mails par tests d'intégration DB réels

Le patron `booking-cancellation-mail.test.ts` (skip si DB indisponible) est étendu à
`price-alert-mail.test.ts` **sans dupliquer la logique métier** : le test reproduit
l'envoi réel du cron (template `priceAlert` + `enqueueEmail` + `deliverEmail`),
vérifie la localisation fr, le destinataire, et l'idempotence (une seule ligne
outbox après deux enqueues, `eventKey` unique).

## Non-régression

- **tsc / eslint / i18n / build / smoke** relancés via `npm run ci` : vert.
- **Vitest serveur-live** (`admin/bulk`, `admin/hosts`) relancés avec serveur actif :
  17/17 → total **554 tests** inchangé.
- Le flux utilisateur (manuel vs en ligne) est identique ; seul le cas anormal devient
  sûr.

## Interactions

- Aucune interaction avec la base, le cron ou le webhook.
- La machinerie Stripe reste présente mais inatteignable ; documentée dans
  `KNOWN_LIMITATIONS.md`.
