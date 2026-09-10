# Validation — T-232, T-233, T-234 (+ volet T-240) — audit n°3

- **Date** : 2026-09-10
- **Statut** : **CORRIGÉ (VALIDÉ)** — cinq constats (F1, F2, F3, F9, F10) implémentés, testés et
  vérifiés au runtime sur serveur réel.
- **Nature** : mise en œuvre des remarques d'analyse, **sans régression et sans casse de
  l'existant** (contrainte explicite de l'utilisateur).
- **Analyse source** : `docs/analyse_2026-09-10_audit_runtime_scenarios.md` (F1→F13).
- **Tâche courante** : `CURRENT_TASK.md` (bloc « Audit n°3 »).

## 1. Portes exécutées

| Porte | Commande | Résultat |
|---|---|---|
| Types | `npm run typecheck` | **0 erreur** |
| Lint | `npm run lint` | **0 erreur / 0 warning** |
| i18n | `npm run i18n:check` | catalogue FR/EN **1640** clés (verrou inchangé, aucun libellé ajouté) |
| Framework | `npm run ai:check` | **19 OK / 1 warn / 0 fail** — warn = R7 (un commit ne peut pas citer son propre SHA), voir `STATE.md` |
| Tests | `npx vitest run` | **709 tests / 120 fichiers — 0 échec** (dont 2 fichiers nécessitant le serveur : 28 tests PASS avec le serveur live) |
| CI complète | `npm run ci` | **verte** : typecheck → lint → i18n → ai:check → vitest → build → smoke |
| Smoke HTTP | inclus dans `npm run ci` | **95 / 95 assertions PASS, 0 FAIL** |

Suite de tests : +3 fichiers (T-232 dates, T-233 suspension d'hôte, T-234 expiration paresseuse),
+2 tests multi-fuseaux sur le cycle de vie (T-240).

## 2. T-232 — dates de séjour et fuseaux (F1, F9, F10)

### Implémentation

- `src/lib/dates.ts` (nouveau) : `toCivilDate`, `civilDateOf`, `civilToday`, `addCivilDays`,
  `civilDaysBetween`, `formatCivilDate` (jour jamais décalé, rendu en UTC),
  `formatTimestamp` (instant, fuseau explicite, UTC par défaut).
- `src/db/index.ts` : `types.setTypeParser(1082, v => v)` — les colonnes `date` sont lues en
  **chaînes** `YYYY-MM-DD` ; `pg` ne fabrique plus un `Date` à minuit local du serveur.
- `src/lib/utils.ts` : `formatDate`/`formatDateShort` délèguent aux helpers (civil vs instant).
- Fenêtres civiles : analytics, calendrier de chambre, dashboard, tunnel de réservation,
  mon-compte, formulaire de profil, gestionnaire de réservations (échéance = instant).
- Les 7 derniers `toLocaleDateString` (pages légales, analytics, calendrier de disponibilité,
  utilisateurs/avis/réservations en masse) sont remplacés : **0 occurrence restante** dans `src/`.
- `users.timezone` est validé (`isValidTimezone`, T-227) et effectivement **lu** comme fuseau
  d'affichage ; horizon métier « aujourd'hui » centralisé (`civilToday("UTC")` dans
  `sendPaymentReminders`, `future-stay`, `room-remaining`, `search-warnings`).

### Preuves

| Preuve | Résultat |
|---|---|
| `src/lib/dates.test.ts` (7 tests, dont 4 fuseaux) | ✅ un séjour du `2026-09-24` s'affiche « 24 septembre 2026 » sous `UTC`, `Africa/Douala`, `America/Los_Angeles`, `Pacific/Kiritimati` |
| Runtime, 4 fuseaux (`TZ=$tz npm run dev`) | ✅ `2026-08-11` → « 11 août 2026 » identique dans les quatre rendus SSR |
| `src/lib/booking-lifecycle.test.ts` (+4 tests multi-fuseaux, volet T-240) | ✅ `transitionError`/`isReviewEligible` rendent la même décision et le même message sous 4 fuseaux |

## 3. T-233 — suspension d'hôte sans effet sur ses annonces (F2)

### Implémentation

- `src/lib/host-suspension.ts` (nouveau) : `suspendHostListings`/`reactivateHostListings`
  (cascade `active ↔ suspended`, **idempotentes**, retournent les identifiants touchés),
  `activeHostCondition` (prédicat SQL typé), `ACTIVE_HOST_ALIAS`.
- Cascade **transactionnelle** : `PATCH /api/users/[id]/suspend` et `POST /api/admin/bulk`
  (suspend/reactivate + audits), dans la même transaction que la suspension du compte.
- Filtres publics : `/recherche`, fiche `/hebergement/[slug]` (dont `metadata`), `POST /api/bookings`
  (« Hébergement non disponible », 400).
- `src/lib/read-cache.ts` : `keys()` ajouté à `TtlCache`, `invalidatePublicCatalog` appelé par la
  suspension et par le bulk ; **cache ancré sur `globalThis.__mbbPublicCatalogCache`**.

### Cause réelle de l'anomalie de cache (à retenir)

Le cache `publicCatalogCache` n'était **pas partagé entre bundles de routes** : la page et la route
API embarquaient deux copies du module, donc l'invalidation n'atteignait jamais l'instance lue par
la fiche. Correctif structurel (même raison que le pool `pg`), complété par une **garde de
visibilité hors cache** (`isPropertyPubliclyVisible`, 1 ligne SQL : `properties.status = 'active'`,
`users.suspendedAt`/`deletedAt` nuls) pour que la fiche ne dépende jamais d'un cache chaud.

### Preuves runtime (serveur réel, port 3000)

| Étape | Résultat |
|---|---|
| Fiche `/hebergement/riad-jardin-secret` avant suspension | **200** |
| Après `PATCH /api/users/[id]/suspend` (hôte) | **404** |
| Re-suspension (idempotence) | **404** (aucune erreur, aucune double cascade) |
| Après réactivation | **200** |
| `GET /api/properties?limit=100` (total) | **8 → 0 → 8** |
| `/recherche` contient l'annonce | **oui → non → oui** |
| `POST /api/bookings` chez hôte suspendu | **400** « Hébergement non disponible » |
| `POST /api/bookings` après réactivation | **201** |
| Base après les sondes | 8 annonces `active`, **0 utilisateur suspendu**, 0 résidu de test |

## 4. T-234 — expiration paresseuse des demandes (F3)

### Implémentation (extraction, pas duplication)

- `src/lib/booking-request-expiration.ts` : la logique de purge quitte la route cron et devient une
  **lib partagée** — `expireRequestInExecutor` (verrou pessimiste + relecture, remboursement
  portefeuille, rendu d'usage promotion, motif d'expiration, échéance purgée),
  `expireRequestsInTransaction` (bornée à une chambre et à une fenêtre), `expireManualBookingRequests`
  (tâche de fond, transaction par candidat + `onExpired` post-commit).
- `src/app/api/cron/price-alerts/route.ts` : ne conserve que le **branchement** (notification
  post-commit), l'export historique reste disponible pour les tests existants.
- `src/lib/booking-request-notifications.ts` (nouveau) : `notifyExpiredRequest` (2 destinataires,
  `eventKey` déterministes) sortie du cron pour être appelable par le tunnel.
- `POST /api/bookings` : purge **dans la transaction**, limitée à la chambre et à la fenêtre, avant
  le calcul des chevauchements ; notifications **après** le commit (jamais d'e-mail dans une
  transaction).
- `GET /api/bookings/quote` : même purge avant évaluation (un devis ne refuse plus un créneau
  « occupé » par une demande morte).
- `src/lib/room-stock.ts` : `loadBookedCounts` (calendrier hôte + API disponibilité) ne compte plus
  une demande `pending` sans `payment_intent_id` dont `request_expires_at <= now()` — le test
  d'expiration est fait **en SQL**, donc insensible au fuseau du process Node.

### Preuves

| Preuve | Résultat |
|---|---|
| `src/app/api/bookings/route.t234.test.ts` (2 tests) | ✅ demande expirée purgée sur le créneau, nouvelle demande **201**, ancienne annulée au motif d'expiration, échéance purgée ; une demande **encore valide bloque toujours (409)** ; le stock lu ne compte plus la demande morte |
| Test **sans** le correctif (retrait temporaire de la purge) | ✅ **409 reproduit** → le test n'est pas vacant (il prouve bien le constat F3) |
| Runtime : demande `pending` insérée avec échéance = maintenant − 1 h | ✅ `GET /api/rooms/[id]/availability` → `booked=0`, `remaining=1` (quantité épinglée à 1) |
| Runtime : `GET /api/bookings/quote` même fenêtre | ✅ **200** chiffré (`ok:true`) |
| Runtime : `POST /api/bookings` même fenêtre | ✅ **201** (avant correctif : 409) |
| Runtime : état de la demande morte après le tunnel | ✅ `cancelled` + motif « Demande de réservation expirée automatiquement… », `request_expires_at` NULL |
| Runtime : disponibilité après purge | ✅ `booked=1`, `remaining=0` (seule la nouvelle demande occupe) |
| Base après les sondes | **0 résidu** (réservations de test supprimées, `rooms.quantity` restaurée, comptes invités de test purgés) : 8 utilisateurs / 8 annonces actives / 34 réservations |

## 5. Non-régression

- `npm run ci` **verte** de bout en bout (7 étapes) ; smoke **95/95**.
- Base démo restaurée à l'identique du seed après toutes les sondes runtime.
- Aucune migration destructive : la seule évolution de schéma liée à ces tâches est déjà en place
  (`bookings.request_expires_at`, `properties.status`, `users.suspended_at`).
- Le cron conserve son comportement (purge globale quotidienne) ; la nouveauté est additive
  (purge paresseuse ciblée + lecture de stock qui ignore les demandes mortes).
