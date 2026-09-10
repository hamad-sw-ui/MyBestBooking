# Tâche courante

- **ID** : T-242 → T-244 (analyse) — livrée ; chantier T-221 → T-231 en cours
- **Titre** : Audit runtime n°4 (profondeur) puis implémentation des correctifs d'audit n°2
- **Statut** : EN COURS (analyse livrée ; correctifs T-242 → T-244 à engager)
- **Niveau** : C (données personnelles persistées — cf. §15.0 : en cas de doute, choisir le niveau le plus élevé)
- **Analyse source** : `docs/analyse_2026-09-10_audit_runtime_profondeur.md` (copie `REPORTS/analyse_runtime_n4_2026-09-10_profondeur.md`)

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

## Chantier en cours (audit n°2)

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
