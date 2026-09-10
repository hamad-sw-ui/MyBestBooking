# Validation T-215 + T-216 — Commission hôte éditable & gestion manuelle des statuts

- **Date** : 2026-09-10
- **Branche** : `arena/01a08b7d-mybestbooking`
- **Niveau** : L (deux évolutions produit ciblées + un correctif de défaut réel)
- **Auteur** : Agent Arena.ai
- **Statut** : IMPLÉMENTÉ (VALIDÉ)
- **Analyse source** : `docs/analyse_2026-09-10_commission_hote_avis_statuts_reservation.md` (§1.5 et §3.3)

## 1. Origine

L'analyse produit du 2026-09-10 a répondu à trois capacités :

| Question | Verdict | Suite |
|---|---|---|
| Q1 — commission éditable par hôte, pour tout statut | OUI partiel | plan §1.5 → **T-215** |
| Q2 — avis (création, modération, réponses, vérifiés) | OUI complet | aucune implémentation |
| Q3 — gestion manuelle des statuts de réservation | OUI partiel (détail uniquement) | plan §3.3 → **T-216** |

Un défaut réel découvert pendant Q1 est corrigé dans le même lot (BUG-050).

## 2. T-215 — commission hôte éditable (Q1 §1.5)

### 2.1 API

- `GET /api/admin/hosts` : correctif BUG-050 — la sous-requête corrélée
  `propertyCount` interpole désormais `"users"."id"` (qualifié) ; sans
  qualification, Drizzle émettait `"id"`, résolu sur `properties.id`, d'où un
  `propertyCount` **toujours nul** même pour un hôte possédant des biens.
- `GET /api/admin/hosts/[id]` (nouveau, lecture seule) : `host`, `globalRate`,
  `effectiveRate`, `inheritCount`, `explicitCount`, `propertyCount`,
  `properties[]` (état **avant** modification).
- `PATCH /api/admin/hosts/[id]` : `approve` / `reject` (contrat T-202 inchangé)
  + action additive `updateCommission` :
  - `commissionRate` ∈ [0, 100] ou `null` (= héritage du taux global) ;
  - `applyTo` : `"inherited"` (hébergements `commission_rate IS NULL`) ou
    `"listed"` + `propertyIds` (≤ 100, liste non vide exigée) ;
  - **jamais** de propagation implicite : sans `applyTo`, seul `users.commissionRate` bouge ;
  - les réservations existantes ne sont pas recalculées (snapshots
    `commissionRate` / `commissionAmount` / `netToHost`, ADR-009) ;
  - audit `host.commission.update` (`previousRate`, `newRate`) et
    `property.commission.update` par hébergement propagé (`reason`) ;
  - réponse `{host, propertiesUpdated}`.

### 2.2 UI

- `HostCommissionEditor` (nouveau, client) sur `/dashboard/users` : affiche
  « Hérite : {global} % » ou le taux explicite, crayon d'édition, champ vide =
  retour à l'héritage, case « Appliquer aux N hébergements qui héritent »
  (décochée par défaut), impact annoncé en infobulle.
- Une seule zone de saisie par hôte : l'éditeur n'apparaît pas en double avec
  l'input d'approbation de `HostApproveActions` (statuts `approved` **ou** taux
  déjà fixé).
- `users/page.tsx` : répartition héritage/explicite par hôte
  (`count(*) FILTER`) + taux global (`settings.billing.defaultCommissionRate`,
  défaut 15).

## 3. T-216 — gestion manuelle des statuts de réservation (Q3 §3.3)

- `PUT /api/bookings/[id]` **non remplacé** : même FSM (`transitionError`),
  même verrou transactionnel, mêmes e-mails, fidélité, remboursements,
  `markPaidOffline` (T-203). Ajout d'un audit `booking.status.update`
  (`{previousStatus, newStatus, actor}`) sur les transitions principales **et**
  sur la voie annulation (`cancelBooking`).
- `BookingStatusSelect` (nouveau, client) dans la colonne Statut de
  `/dashboard/bookings` : transitions dérivées de `availableTransitions()`
  (aucune règle dupliquée), annulation triée en dernier, confirmation avant
  `completed` / `no_show` / `cancelled`, toast + refresh, badge historique
  conservé à l'identique quand aucune transition n'existe.
- `availableTransitions` (nouveau, pur) : dérivé exclusivement de
  `transitionError()` + garde paiement (`completed` seulement si `paid`).
- La page détail `bookings/[id]` reste inchangée.

## 4. Non-régression

| Zone à risque | Vérification |
|---|---|
| FSM / statuts | `booking-lifecycle.test.ts` 11 ✓ (matrice complète + invariant « proposé ⇒ accepté ») ; comportements serveur re-testés (400/409/200) |
| Snapshots de commission | Aucune écriture de `bookings.commission*` dans `updateCommission` ; propagation limitée à `properties.commissionRate` |
| Approbation hôte (T-202) | Branches `approve` / `reject` intactes ; re-approbation sans taux conserve le taux |
| Bulk admin | Contrat `{entity, action, requested, succeeded, skipped[], failed[]}` inchangé ; `route.test.ts` 12 ✓ |
| Paiement manuel (T-203) | `markPaidOffline` intact ; testé en runtime (→ `completed` après constat de paiement) |
| i18n FR/EN | catalogue **1532** clés dans les deux langues (`+16`), `i18n:check` 0 candidat |
| UI existante | Badges, filtres, stats, raccourcis et outils bulk conservés ; le badge est passé en *prop* à l'éditeur de statut pour préserver le rendu |

## 5. Preuves

- 🔨 `npm run typecheck` : 0 erreur (après ajout des 4 fichiers de test de composants).
- 🔨 `npm run lint` : 0 erreur / 0 warning.
- 🔍 `npm run i18n:check` : 0 candidat (catalogue FR = EN = 1532).
- 🔨 `npx next build` : 65 pages générées, exit 0.
- 🧪 `npx vitest run` : **107 fichiers / 642 tests passés, 0 échec** (serveur dev et Postgres embarqué actifs, donc aucun skip d'intégration).
- 🧪 Ciblés : `booking-lifecycle.test.ts` 11 ✓ · `admin/hosts/route.test.ts` 16 ✓ · `bookings/[id]/route.t216.test.ts` 7 ✓ · `booking-status-select.test.tsx` 6 ✓ · `host-commission-editor.test.tsx` 6 ✓ · `bookings-manager.test.tsx` 3 ✓ · `users-manager.test.tsx` 7 ✓.
- ▶️ Runtime API (dev :3000, base seed) : `propertyCount` 8 (était 0) ; aperçu `GET` 15 % hérités / 0 · 8 explicites ; `PATCH updateCommission` (12 → propagation `listed` 1 → `inherited` 0 → `null` reset) ; erreurs 400 (taux hors bornes, `listed` sans ids) / 403 (non-admin) / 404 (id inconnu) ; audits `host.commission.update` + `property.commission.update` présents en base.
- ▶️ Runtime API statuts : `pending→confirmed` 200 · clôture payée après départ 200 · clôture avant départ 400 · clôture non payée 409 · voyageur sur `completed` 400 · état terminal 400 · `markPaidOffline` puis clôture 200 · audit `booking.status.update` présent (transitions + annulation).
- ▶️ SSR : `/dashboard/users` affiche « Hérite : 15 % », le crayon et l'impact ; `/dashboard/bookings` (session hôte) n'affiche l'action que sur `pending`/`confirmed`.
- ▶️ `npm run ci` : chaîne complète verte (typecheck → lint → i18n → ai:check → vitest → build → smoke **95/95**).
- ✅ `npm run ai:check` : 19 OK / 1 warn / 0 fail (le warn est préexistant et sans rapport).
- 🔍 Base laissée à l'état seed : 8 utilisateurs / 8 hébergements / 33 réservations / 24 avis / `email_outbox` 0.

## 6. Limites connues

- Aucun E2E navigateur : Chromium n'est pas installable dans ce sandbox
  (`playwright install chromium-headless-shell` échoue au téléchargement) et le
  dépôt n'embarque ni jsdom ni Testing Library. Les composants clients sont donc
  couverts par un rendu serveur (`react-dom/server`) de la vue repliée + les
  tests de la logique pure (`availableTransitions`) + les tests d'intégration API.
  Le pack navigateur reste au backlog (T-213).
- Aucune modification de schéma : `users.commissionRate` et les colonnes de
  snapshot existaient déjà (T-202), donc aucune migration n'est requise.
