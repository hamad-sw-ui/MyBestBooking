# Tâche courante

- **ID** : T-215 + T-216
- **Titre** : Commission hôte éditable pour tout statut (Q1 §1.5) + gestion manuelle des statuts de réservation dans la liste (Q3 §3.3)
- **Statut** : CORRIGÉ (VALIDÉ)
- **Niveau** : **L** (deux évolutions produit ciblées + correctif BUG-050)
- **Analyse source** : `docs/analyse_2026-09-10_commission_hote_avis_statuts_reservation.md` (verdicts Q1 « OUI partiel », Q2 « OUI complet » → rien à faire, Q3 « OUI partiel »)

## Contexte

L'analyse produit du 2026-09-10 a établi que :

1. la commission d'un hôte n'était saisissable qu'**au moment de l'approbation**
   (`HostApproveActions`) : un hôte déjà approuvé n'avait aucune zone d'édition,
   et `GET /api/admin/hosts` renvoyait un `propertyCount` toujours nul ;
2. la gestion des statuts de réservation n'existait que sur la page **détail** ;
   la liste `/dashboard/bookings` n'affichait qu'un badge.

## Livré

### T-215 — commission hôte

1. Correctif **BUG-050** : sous-requête corrélée `propertyCount` qualifiée
   (`"users"."id"`).
2. `GET /api/admin/hosts/[id]` : aperçu lecture seule (`host`, `globalRate`,
   `effectiveRate`, `inheritCount`, `explicitCount`, `propertyCount`,
   `properties[]`).
3. `PATCH /api/admin/hosts/[id]` : action additive `updateCommission`
   (`commissionRate` 0–100 ou `null` = héritage ; `applyTo: inherited|listed` +
   `propertyIds` ≤ 100) ; `approve`/`reject` T-202 inchangés ; propagation jamais
   implicite ; snapshots de vente intacts ; audits `host.commission.update` et
   `property.commission.update`.
4. `HostCommissionEditor` sur `/dashboard/users` (tout statut d'approbation,
   une seule zone de saisie par hôte) + répartition héritage/explicite calculée
   dans `users/page.tsx`.

### T-216 — statuts de réservation dans la liste

1. `availableTransitions()` (pure) : transitions proposables dérivées de
   `transitionError()` + garde paiement.
2. `BookingStatusSelect` dans la colonne Statut de `/dashboard/bookings`
   (hôte propriétaire et admin), badge historique conservé sinon.
3. Audit `booking.status.update` sur les transitions **et** l'annulation
   (`cancelBooking`). `PUT /api/bookings/[id]` reste l'unique source de vérité.

## Validation

- `npm run typecheck` : ✅ 0 erreur.
- `npm run lint` : ✅ 0 erreur / 0 warning.
- `npm run i18n:check` : ✅ 0 candidat (catalogue FR = EN = 1532 clés).
- `npx next build` : ✅ 65 pages.
- `npx vitest run` : ✅ **107 fichiers / 642 tests passés, 0 échec**.
- Runtime API + SSR : ✅ voir `REPORTS/validation_T215_T216_2026-09-10_commission_hote_statuts_reservation.md`.
- `npm run ai:check` : ✅ 19 OK / 1 warn (préexistant) / 0 fail.
- `npm run ci` : ✅ chaîne complète verte (smoke 95/95).

## Rapports

- `docs/analyse_2026-09-10_commission_hote_avis_statuts_reservation.md` (analyse d'origine)
- `.ai/REPORTS/validation_T215_T216_2026-09-10_commission_hote_statuts_reservation.md`
