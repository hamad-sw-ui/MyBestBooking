# Analyse d'impact — T-232 / T-233 / T-234 (+ volet T-240) — audit n°3

- **Date** : 2026-09-10
- **Niveau** : C (données personnelles persistées, cf. `CODING_RULES.md` §15.0)
- **Analyse source** : `docs/analyse_2026-09-10_audit_runtime_scenarios.md` (F1→F13)
- **Livrable** : `REPORTS/validation_T232_T234_2026-09-10_dates_suspension_expiration.md`
- **Conception** : `REPORTS/analyse_conception_T-232_2026-09-10_dates_fuseaux_suspension_expiration.md`

## 1. Périmètre modifié

| Domaine | Fichiers | Nature du changement |
|---|---|---|
| Dates civiles (T-232) | `src/lib/dates.ts` (nouveau), `src/lib/utils.ts`, `src/db/index.ts` | Helper unique + parser `date` en chaînes |
| Affichage des dates | dashboard (page, analytics, bookings, calendrier de chambre), tunnel de réservation, mon-compte, formulaire de profil, gestionnaires en masse (réservations, utilisateurs, avis), calendrier de disponibilité, pages légales | Remplacent `toLocaleDateString`/`new Date(...)` par les helpers |
| Fuseau d'affichage | `src/app/(main)/mon-compte/account-client.tsx`, `src/components/profile-form.tsx` | `users.timezone` validé et effectivement lu |
| Horizon métier | `src/app/api/cron/price-alerts/route.ts`, `src/lib/future-stay.ts`, `src/lib/room-remaining.ts`, `src/lib/search-warnings.ts` | « Aujourd'hui » = `civilToday("UTC")` |
| Cascade de suspension (T-233) | `src/lib/host-suspension.ts` (nouveau), `src/app/api/users/[id]/suspend/route.ts`, `src/app/api/admin/bulk/route.ts` | Bascule transactionnelle `active ↔ suspended` |
| Surfaces publiques | `src/app/(main)/recherche/page.tsx`, `src/app/(main)/hebergement/[slug]/page.tsx`, `src/app/api/bookings/route.ts` | Filtre « hôte actif » + garde hors cache |
| Cache catalogue | `src/lib/read-cache.ts` | `keys()`, cache ancré `globalThis`, `invalidatePublicCatalog` |
| Expiration (T-234) | `src/lib/booking-request-expiration.ts`, `src/lib/booking-request-notifications.ts` (nouveau), `src/app/api/cron/price-alerts/route.ts`, `src/app/api/bookings/route.ts`, `src/app/api/bookings/quote/route.ts`, `src/lib/room-stock.ts` | Purge partagée, exécutée dans la transaction du tunnel |

Changements **additifs** au schéma : aucun. Les colonnes utilisées (`bookings.request_expires_at`,
`properties.status`, `users.suspended_at`, `users.timezone`) existent déjà.

## 2. Ce qui pouvait casser, et pourquoi ça n'a pas cassé

1. **Lecture `date` en chaîne (T-232)** — tout consommateur qui appelait `.toISOString()` ou
   `.getTime()` sur un `check_in` recevait un `Date` et reçoit désormais une chaîne. Mitigation :
   `toCivilDate()` normalise les deux formes, les tests existants (réservations, calendriers,
   analytics, lifecycle) sont passés **sans modification**, et la suite complète est verte
   (709 tests).
2. **Filtres publics (T-233)** — restreindre les annonces visibles pouvait masquer des biens
   légitimes. Le prédicat ne dépend que de `properties.status` et de l'état du compte hôte
   (`suspended_at`, `deleted_at` nuls) ; un hôte **non suspendu** garde exactement ses 8 annonces
   (vérifié : total public `8 → 0 → 8` autour de la suspension, jamais `7`).
3. **Invalidation du cache (T-233)** — l'ancrage `globalThis` du cache est le correctif du défaut
   réel (deux instances de module entre bundles page et route). Risque associé : un cache partagé
   peut servir des données périmées si un chemin d'écriture oublie d'invalider. Mitigation : la
   fiche porte une **garde de visibilité hors cache** (une requête d'une ligne), donc l'exactitude
   ne dépend plus de la fraîcheur du catalogue ; la liste publique, elle, reste bornée par le TTL.
4. **Expiration dans une transaction (T-234)** — la purge écrit (`status`, `cancellationReason`,
   remboursement portefeuille, usage promotion, `requestExpiresAt`) **pendant** la transaction de
   création : un échec de la création annule aussi la purge (comportement voulu : la demande morte
   sera reprise par le cron). Les e-mails, eux, sont envoyés **après commit** : aucune I/O réseau
   dans une transaction, aucun e-mail fantôme en cas de rollback.
5. **Stock lu sans les demandes mortes (T-234)** — le test d'expiration est fait en SQL
   (`now()`), pas avec l'horloge de Node : le calendrier et l'API de disponibilité restent
   cohérents même si le process a un fuseau différent de la base.
6. **Cron inchangé dans son contrat** — `expireManualBookingRequests` conserve sa signature et son
   export (la route ne fait plus que brancher la notification) : les tests d'intégration du cron
   passent sans adaptation.

## 3. Effets de bord assumés

- Une demande `pending` expirée n'occupe plus les dates **avant** la purge : si un hôte souhaitait
  confirmer une demande très en retard (> TTL), la confirmation reste possible au niveau API
  (`PUT /api/bookings/[id]`) mais la chambre a pu être vendue entre-temps — c'est précisément la
  règle métier du TTL (24 h, max 168 h).
- La fiche publique fait une requête supplémentaire (garde de visibilité) : coût d'une ligne
  indexée, échangé contre la garantie d'exactitude.
- Les pages légales affichent la date civile **UTC** du jour : sur un fuseau très en avance (ex.
  Kiritimati), la mention peut porter la veille pendant quelques heures. C'était déjà le cas avec
  le fuseau du runtime, variable selon l'instance — désormais la valeur est **déterministe**.

## 4. Risques résiduels

| Risque | Probabilité | Traitement |
|---|---|---|
| Un chemin d'écriture oublie d'invalider le catalogue | Faible | Garde hors cache sur la fiche ; test d'inventaire T-231 ; bulk et suspension câblés |
| `TZ` du serveur appliqué ailleurs (payouts mensuels) | Faible | Hors périmètre : décision métier (fuseau de versement) à trancher, documenté |
| Purge paresseuse non déclenchée faute de trafic | Faible | Le cron quotidien reste le filet de sécurité (comportement inchangé) |

## 5. Preuves attendues (porte de sortie)

- `npm run typecheck` 0 · `npm run lint` 0/0 · `npm run i18n:check` (catalogue inchangé, 1640) ·
  `npm run ai:check` 0 fail · `npx vitest run` 0 échec · `npm run ci` verte (build + smoke 95/95).
- Runtime : fiche `200 → 404 → 404 → 200` ; total d'annonces `8 → 0 → 8` ; réservation chez hôte
  suspendu `400`, après réactivation `201` ; demande expirée purgée par le tunnel (`201` au lieu de
  `409`, `409` reproduit en retirant le correctif) ; disponibilité `0/1 → 1/0`.
- Base remise à l'état seed, **0 résidu** de sonde.
