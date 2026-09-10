# Tâche courante

- **ID** : T-221 → T-231 (audit n°2) + T-242 → T-244 (audit n°4)
- **Titre** : Mise en œuvre des remarques d'audit — fonctionnalités inachevées, cycle de vie des données, stock vendable
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
