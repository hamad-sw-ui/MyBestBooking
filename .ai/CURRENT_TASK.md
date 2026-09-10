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

## Validation

- `npm run typecheck` : ✅ 0 erreur.
- `npm run lint` : ✅ 0 erreur / 0 warning.
- `npm run i18n:check` : ✅ 0 candidat (catalogue FR = EN = **1559** clés).
- `npx vitest run` : ✅ **109 fichiers / 652 tests, 0 échec** (+10 tests).
- `npx next build` : ✅ 65 pages.
- `npm run smoke` : ✅ **95/95** (assertion `/maintenance` corrigée).
- Matrice production : ✅ 8 URL invalides → 404 · 18 pages valides → 200.
- `npm run ai:check` : ✅ 19 OK / 1 warn R7 (levé par le commit `docs(state)`) / 0 fail.

## Rapports

- `docs/analyse_2026-09-10_audit_runtime_fonctionnalites.md` (analyse d'origine)
- `.ai/REPORTS/validation_T217_2026-09-10_correctifs_audit_runtime.md`
