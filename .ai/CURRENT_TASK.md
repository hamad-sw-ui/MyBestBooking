# Tâche courante

- **ID** : T-217
- **Titre** : Correctifs P1–P10 de l'audit runtime — soft-404, édition hébergement, modération, justificatifs, promotions, chambres, messagerie, versements, audit, navigation
- **Statut** : CORRIGÉ (VALIDÉ)
- **Niveau** : **L** (dix correctifs ciblés, aucun changement de schéma)
- **Analyse source** : `docs/analyse_2026-09-10_audit_runtime_fonctionnalites.md` (commit `e8ecc71`)

## Contexte

L'audit runtime du 2026-09-10 a relevé dix défauts d'exécution (P1–P10) :
statuts HTTP faux pour les pages introuvables (soft-404 SEO), écran d'édition
d'hébergement entièrement client, réglage de modération des avis sans UI, aucun
justificatif pour les séjours passés, API d'édition des promotions sans écran,
édition de chambre enfouie + route absente, fil de messagerie vide introuvable,
carte « Factures » qui listait des versements, code mort/routes sans appelant et
audit plafonné à 100 lignes, navigation admin sans « Chambres ».

## Livré

1. **P1** — `src/app/loading.tsx` racine supprimé au profit de squelettes
   **feuilles** (`src/components/page-loading.tsx` + 11 routes de liste) :
   les pages `notFound()` renvoient un vrai 404 en production.
2. **P2** — `/dashboard/properties/[id]` découpé en RSC (`isUuid`, `notFound()`,
   garde de rôle) + client amorcé (`initialProperty`/`initialRooms`/`isAdmin`).
3. **P3** — section « Avis » dans `/dashboard/settings` (bascule
   `reviews.requireModeration`) branchée sur l'API existante.
4. **P4** — `BookingRowActions` dans les cartes « Passées » de
   `/mes-reservations` (reçu/facture pour un séjour payé).
5. **P5** — `/dashboard/promotions/[id]` + `PromotionEditForm` (PATCH existant ;
   `null` accepté pour les plafonds ; `currentUses` préservé).
6. **P6** — `/dashboard/rooms/[id]` redirige vers `/calendrier#room-edit` ;
   lien « Modifier l'unité » dans la liste.
7. **P7** — fil vide visible 7 jours dans `/messages` (libellé « brouillon »),
   compteurs/API inchangés (T-206/F9 conservé au-delà).
8. **P8** — carte billing renommée « Versements et relevés » + pointeur vers les
   reçus par réservation.
9. **P9** — `/dashboard/audit` branché sur `GET /api/admin/audit` (« Charger
   plus ») ; composants orphelins `@deprecated` et documentés.
10. **P10** — `/dashboard/rooms` ajouté aux `adminLinks` desktop et mobile.
11. **Complément T-219** — libellés d'export distingués : « Export CSV
    (versements) » (carte billing) vs « Export CSV (réservations) »
    (`/dashboard/bookings`). T-218 (e-mail à la création d'un fil vide) **non
    retenu** : `POST /api/messages` notifie déjà le destinataire, un e-mail sans
    contenu serait du spam ; le rattrapage du fil non écrit est assuré par P7.
    T-220 (préférences de notification par utilisateur) reste au backlog.

## Validation

- `npm run typecheck` : ✅ 0 erreur.
- `npm run lint` : ✅ 0 erreur / 0 warning.
- `npm run i18n:check` : ✅ 0 candidat (catalogue FR = EN = **1559** clés).
- `npx vitest run` : ✅ **109 fichiers / 652 tests, 0 échec** (+10 tests).
- `npx next build` : ✅ 65 pages.
- `npm run smoke` : ✅ **95/95** (assertion `/maintenance` corrigée).
- Matrice production : ✅ 8 URL invalides → 404 · 18 pages valides → 200.
- **Balayage exhaustif des 10 pages `notFound()`** : ✅ 14 sondes invalides → 404
  en production ; contreparties valides → 200 (307 pour la redirection chambres).
- **P4 bout en bout** : ✅ reçu voyageur 200 (référence présente) · autrui 403 ·
  anonyme 401 · hôte/admin 200.
- `npm run ai:check` : ✅ 19 OK / 1 warn R7 (levé par le commit `docs(state)`) / 0 fail.

## Rapports

- `docs/analyse_2026-09-10_audit_runtime_fonctionnalites.md` (analyse d'origine)
- `.ai/REPORTS/validation_T217_2026-09-10_correctifs_audit_runtime.md`

## Suites — audit n°2 (2026-09-10)

Deuxième passe d'analyse runtime livrée **à titre d'analyse seule** (aucun code produit
modifié) : `docs/analyse_2026-09-10_audit_runtime_inacheves.md`. Méthode : 3 rôles + visiteur,
43 pages, 67 routes API, **261 liens internes suivis (0 cassé)**, sondes d'exécution
(création/expiration de demande, fil de conversation par rôle, suspension/réactivation,
suppression de compte, confirmation de paiement) puis base remise à l'état seed.

11 constats, priorisés et tracés dans `BACKLOG.md` sous T-221 → T-231 :

1. **T-221** — échéance des demandes de réservation invisible et non notifiée (TTL 24 h).
2. **T-222** — séjours échus non réglés : aucune vue ni relance « à constater ».
3. **T-223** — interrupteurs `notifications` (7 booléens) sans section admin.
4. **T-224** — paramètres de parrainage (`bestrewards.referral`) non éditables.
5. **T-225** — aucun e-mail d'avis (publication côté hôte, issue de modération côté auteur).
6. **T-226** — édition de chambre limitée à 7 champs sur les 14 acceptés par l'API.
7. **T-227** — horaires d'arrivée/départ affichés mais absents des API/formulaires.
8. **T-228** — labels non administrables ; badge « Éco » inatteignable.
9. **T-229** — libellé « Écrire à l'hébergeur » faux pour l'hôte, action 403 pour l'admin.
10. **T-230** — suspension et suppression partagent `deleted_at` (compte « zombie »
    réactivable) ; aucune notification de suspension.
11. **T-231** — 2FA sans codes de secours ni geste support.

Observations complémentaires : `wallet_transactions`/historique de solde, calendrier sans
réservations, vue `email_outbox`, édition d'avis par son auteur, fiche utilisateur admin,
export analytics.
