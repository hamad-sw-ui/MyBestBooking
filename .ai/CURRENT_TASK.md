# Tâche courante

- **ID** : T-271 → T-275 (audit n°8 — implémentation des constats **F1 → F5**, 2026-09-11)
- **Niveau** : C (le plus ambitieux du lot : T-273 et T-275 sont en C —
  débat §15.2 fait ; T-271/T-272/T-274 en S avec rapport d'impact + conception)
- **Titre** : Correction non régressive des 5 constats de l'audit runtime n°8
  (500 `/mes-reservations`, no-show muet, remboursement manuel finalisable,
  alertes prix post-suppression, renvoi du claim invité)
- **Statut** : ✅ **CORRIGÉ (VALIDÉ)** (2026-09-11) — les 5 constats sont
  livrés, testés et prouvés au runtime ; chaîne CI complète verte ; base
  rendue à l'état seed exact. Preuves rejouables :
  `REPORTS/validation_T271_T275_2026-09-11_audit8.md`.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_n8_parcours_execution.md`
  (copie `.ai/REPORTS/analyse_2026-09-11_audit_runtime_n8_parcours_execution.md`)
- **Documents pré-code (avant toute ligne de code)** :
  - `REPORTS/analyse_impact_T271_T275_2026-09-11_audit8.md` (§14, 9 questions,
    faits cités) ;
  - `REPORTS/analyse_conception_T271_T275_2026-09-11_audit8.md` (§15.1,
    3+ options par tâche, retenue argumentée) ;
  - `REPORTS/debat_technique_T273_T275_2026-09-11_audit8.md` (§15.2, 10 rôles,
    objections vérifiées dans le code).
- **Tâches** :
  - **T-271 (S)** — `formatTimestamp` : styles Intl exclusifs des composants
    (fix du 500, `src/lib/dates.ts`) + tests.
  - **T-272 (S)** — e-mail voyageur au no-show (gabarit FR/EN,
    `sendNoShowNotificationIfNeeded` idempotent, interrupteur
    `notifications.bookingNoShow` défaut `true`, hook best-effort post-commit
    dans `PUT /api/bookings/[id]`).
  - **T-273 (C)** — `POST /api/bookings/[id]/refund` (hôte/admin ; gardes
    `paid` + `refundStatus='none'` + `paymentIntentId IS NULL` ; `FOR UPDATE` ;
    audit `booking.refund.manual` ; e-mail best-effort) + bouton UI
    `BookingRowActions` (motif obligatoire `ReasonDialog`).
  - **T-274 (S)** — anonymisation : `price_alerts.active=false` +
    `users.priceAlertEnabled=false` (même tx) + garde `isNull(users.deletedAt)`
    dans le scan cron (défense en profondeur).
  - **T-275 (C)** — `POST /api/auth/resend-guest-claim` (réf. + email exact,
    4 gardes, réponse générique anti-énumération, rate-limit email 3/h + IP
    10/h, jeton `guest_claim` neuf, eventKey timestampé) + bouton UI sur
    l'écran de confirmation du tunnel guest.
- **Garde-fous non-régression** : aucune migration (toutes les colonnes
  existent) ; aucun contrat d'API existant modifié ; FSM de statuts intacte ;
  voie PSP exclusivement Stripe (garde `paymentIntentId IS NULL` sur le
  refund manuel) ; e-mails existants strictement inchangés (gabarits ajoutés,
  jamais modifiés) ; réglage nouveau additif défaut `true` (`mergeDefaults`).
- **Preuves livrées (toutes rejouables)** : `dates.t271` 35/35 ·
  `no-show-notification.t272` 5/5 · `refund/route.t273` 10/10 ·
  `account-anonymization.t274` 2/2 + `cron/price-alerts/route.t274` 3/3 ·
  `resend-guest-claim/route.t275` 8/8 · non-régression des voisins (vitest
  intégral **161 f / 858 t, 0 échec**) · `npm run ci` complète **verte**
  (typecheck · lint 0/0 · i18n · ai:check 19 OK / 1 warn R7 / 0 fail · build ·
  smoke 95/95) · runtime réel des 5 scénarios (détails dans le rapport) · base
  rendue à l'état seed exact. Verrou i18n **1770 → 1774**.
