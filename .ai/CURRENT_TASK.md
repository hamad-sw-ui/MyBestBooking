# Tâche courante

- **ID** : T-232 + T-233 + T-234 (audit n°3) + volet T-240
- **Titre** : Dates de séjour et fuseaux, cascade de suspension d'hôte, expiration paresseuse des demandes
- **Statut** : CORRIGÉ (VALIDÉ) — 2026-09-10 : les constats F1/F9/F10 (T-232), F2 (T-233) et F3
  (T-234) sont implémentés, testés et vérifiés au runtime ; reliquat de T-240 (tests multi-fuseaux)
  couvert
- **Niveau** : C (données personnelles persistées — cf. §15.0)
- **Analyse source** : `docs/analyse_2026-09-10_audit_runtime_scenarios.md` (F1→F13)
- **Rapport de cette tâche** : `REPORTS/validation_T232_T234_2026-09-10_dates_suspension_expiration.md`

## Livraison T-232 / T-233 / T-234 (2026-09-10)

**T-232 (F1 + F9 + F10) — dates et fuseaux.** Helper unique `src/lib/dates.ts` (date civile jamais
décalée vs instant à fuseau explicite) ; `pg` lit les colonnes `date` en chaînes ; fenêtres civiles
(analytics, calendriers, dashboard, tunnel, mon-compte, gestionnaire de réservations) ; les 7
derniers `toLocaleDateString` remplacés — **0 occurrence** dans `src/` ; `users.timezone` validé et
réellement lu comme fuseau d'affichage.

**T-233 (F2) — suspension d'hôte.** `src/lib/host-suspension.ts` : cascade transactionnelle et
idempotente `active ↔ suspended` depuis `PATCH /api/users/[id]/suspend` et `POST /api/admin/bulk` ;
filtres publics (recherche, fiche dont `metadata`, tunnel) ; cache du catalogue ancré sur
`globalThis` et invalidé à chaque changement, plus **garde de visibilité hors cache** sur la fiche.

**T-234 (F3) — expiration paresseuse.** Purge extraite dans `src/lib/booking-request-expiration.ts`
(le cron n'en garde que le branchement), exécutée **dans la transaction** de `POST /api/bookings` et
de `GET /api/bookings/quote`, bornée à la chambre et à la fenêtre, notifications **après** commit ;
`loadBookedCounts` ne compte plus une demande `pending` expirée (`now()` SQL).

**Preuves.** `npm run ci` verte : typecheck 0 · lint 0/0 · i18n 1640 · ai:check 19 OK / 1 warn (R7) /
0 fail · vitest **709 tests / 120 fichiers, 0 échec** · build · smoke **95/95**. Runtime : fiche
`200 → 404 → 404 → 200`, total d'annonces `8 → 0 → 8`, réservation `400` (« Hébergement non
disponible ») puis `201` ; demande expirée purgée par le tunnel (**201 au lieu de 409** — le `409`
du constat est reproduit en retirant le correctif), disponibilité `0/1 → 1/0`. Base restaurée au
seed exact (8 users / 8 annonces `active` / 34 réservations / 25 avis).

## Étape précédente — T-221 → T-231 (audit n°2) + T-242 → T-244 (audit n°4)

- **Statut** : CORRIGÉ (VALIDÉ) — 2026-09-10 : les 14 constats A1→A11 et N1→N3 sont implémentés, testés et vérifiés au runtime
- **Niveau** : C (données personnelles persistées — cf. §15.0 : en cas de doute, choisir le niveau le plus élevé)
- **Analyses sources** : `docs/analyse_2026-09-10_audit_runtime_inacheves.md` (A1→A11) et
  `docs/analyse_2026-09-10_audit_runtime_profondeur.md` (N1→N3, copie `REPORTS/analyse_runtime_n4_2026-09-10_profondeur.md`)
- **Rapports de cette tâche** : `REPORTS/analyse_impact_T-221_2026-09-10_mise_en_oeuvre_audits.md`
  (impact §14) et `REPORTS/analyse_conception_T-221_2026-09-10_mise_en_oeuvre_audits.md`
  (conception §15.1)

## Contexte

Quatrième passe d'analyse à l'exécution, orientée sur des surfaces jamais sondées :
cloisonnement multi-tenant (24 cas × 5 identités, second hôte et annonce brouillon créés pour la
mesure), cycle de vie des données personnelles après suppression de compte, rétention technique,
et écart entre le stock affiché au calendrier hôte et le stock réellement vendable.

Trois constats nouveaux en sortent — **T-242** (anonymisation partielle : l'identité survit dans
`bookings.guest_*`, `email_outbox.to`, `audit_log.targetEmail`), **T-243** (aucune purge des
sessions expirées, e-mails livrés et journaux d'audit) et **T-244** (le calendrier affiche le
stock déclaré sans retirer les séjours). Les sept autres constats de la campagne confirment avec
preuves chiffrées les tâches déjà planifiées T-227 et T-232 → T-236 / T-241.

## Livraison (implémentation)

Les quatorze constats sont **implémentés et validés** : A1 (échéance des demandes), A2 (séjours
échus non réglés), A3 (interrupteurs d'e-mails), A4 (parrainage réglable), A5 (notifications
d'avis), A6 (édition complète de chambre), A7 (horaires d'arrivée/départ + fuseau validés),
A8 (labels/badges réservés à l'admin en PUT et POST), A9 (libellé du fil par acteur), A10
(`suspended_at` distinct de `deleted_at`, migration `0021`, `409` sur compte anonymisé),
A11 (codes de secours 2FA hachés à usage unique + reset support `user.2fa.reset`), T-242
(anonymisation transactionnelle complète), T-243 (purge technique en cron), T-244 (« Reste
vendable » au calendrier hôte).

Preuves : `npm run ci` verte (typecheck 0 · lint 0 · i18n 0 · **vitest 691 tests** · build ·
smoke) ; `ai:check` ; vérifications runtime sur serveur réel (parcours 2FA complet, suspension /
réactivation / `409`, horaires et fuseau persistés, labels `403` hôte / `200` admin, calendrier
« reste 2 (1 réservé) »). Base remise à l'état seed (8 users / 8 properties / 31 bookings /
22 avis).

## Chantier d'origine (audit n°2, contexte conservé)

L'implémentation de **T-221 → T-231** est engagée dans l'arbre de travail, hors de ce livrable
d'analyse : A1 (échéance des demandes) et A2 (règlements échus) livrés, plus A3 (interrupteurs
d'e-mails), A4 (parrainage réglable), A5 (notifications d'avis) et A6 (édition complète de
chambre). Restent A7 (horaires d'arrivée/départ), A8 (badges administrables), A9 (libellé du fil),
A10 (`suspended_at`) et A11 (codes de secours 2FA).

## Livré par cette passe

1. **Analyse** : `docs/analyse_2026-09-10_audit_runtime_profondeur.md` + copie `.ai/REPORTS/` ;
   BACKLOG T-242 → T-244 ; PROGRESS et DEVLOG.
2. **Preuves positives** : matrice de permissions exhaustive, révocation de session souhaitée à
   toutes les entrées, restitution unique des bénéfices (promotion/wallet) à l'annulation,
   idempotence `email_outbox`, `POST /api/seed` fermé hors environnement démo, 404 sur brouillons
   et wishlists privées, aucune route orpheline hors tombeau 410 du paiement (T-207).
3. **Aucun code produit modifié** par cette passe ; base remise à l'état seed et sondes supprimées.
