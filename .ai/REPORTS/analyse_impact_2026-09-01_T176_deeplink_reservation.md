# Analyse d'impact — T-176 deep-links réservation incomplets

- **Date** : 2026-09-01
- **Tâche** : T-176
- **Niveau** : S (rattrapage conditionnel — chemins existants préservés)

## Problème (prouvé à l'exécution)

`/reservation?roomId=…` sans `property` et `/reservation?property=…` sans
`room` affichaient l'état « Informations de réservation manquantes » + bouton
« Rechercher un hébergement » sans aucune tentative de rattrapage, alors que
l'information manquante est **déductible** :
- une chambre appartient à une propriété (`/api/rooms/[id]` existe et rend
  `propertyId`) ;
- une propriété seule se laisse renvoyer vers `/hebergement/[slug]` où
  figurent ses chambres.
Détails : `audit_execution_2026-09-01_T176_deeplink_reservation.md`.

## Surface impactée

- `src/lib/reservation-url.ts` : + `describeIncompleteLink()` (pure).
- `src/lib/reservation-url.test.ts` : +5 cas (7/7 au total sur le fichier).
- `src/app/(main)/reservation/reservation-form.tsx` :
  - état `resolvingLink`, effet de résolution (fetch room / redirect fiche) ;
  - pied de page « Chargement… » (clé existante `reservation.loading`) tant
    que la résolution est en cours — **aucun texte nouveau, aucune clé i18n
    ajoutée, aucun contrat d'URL changé** (R18) ;
  - loader seul : la branche `error` et `missingInfo` est intacte en
    dernier ressort.

## Risques & garde-fous

- Régression du tunnel nominal : **impossible** — `describeIncompleteLink`
  renvoie null sur lien complet (court-circuit avant tout effet).
- `?booking=` (reprise de paiement T-152) : explicitement exclu, tests à
  l'appui.
- Room inexistante / propriété inexistante : 404 → état「 manquantes 」
  (comportement historique).
- Boucle de redirection : impossible — la fiche génère des CTA complets
  (property+room) via `buildReservationUrl`.
- L'effet dépend de primitives (`kind`, ids) et non de l'objet recréé
  chaque rendu ; cleanup `cancelled` contre les setState post-unmount.

## Preuves attendues

tsc · eslint · vitest complet (450) · build prod · runtime : roomId seul →
Chargement, property seul → Chargement puis redirect, vide → missingInfo,
complet → tunnel — + smoke 94/94 + ai:check.
