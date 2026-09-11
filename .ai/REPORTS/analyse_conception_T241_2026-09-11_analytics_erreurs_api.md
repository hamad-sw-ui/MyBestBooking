# Analyse de conception — T-241 (audit n°3 : F11 + F12 + F13)

- **Date** : 2026-09-11
- **Principe directeur** : finir ce qui existe déjà plutôt que d'ajouter des mécanismes.

## (a) F11 — « Supprimé » et « suspendu » restaient confondus

Le correctif est **déjà en place** (T-230) : `users.suspended_at` est une colonne distincte de
`deleted_at`, `users-manager.tsx` dérive les deux états et passe `deleted` à
`UserSuspendActions`, qui remplace le bouton **Réactiver** par « Compte anonymisé — non
réactivable ». Vérifié ici : les deux colonnes existent, la clé i18n
`bulk.deletedNoReactivate` est présente en FR et EN. Aucun code ajouté — la tâche T-241 mentionnait
ce volet « à fusionner avec T-230 », c'est fait.

## (b) F12 — analytics figé sur 30 jours glissants

**Décision : une période explicite, civile, avec le défaut historique.**

1. `src/lib/analytics-period.ts` est **pur** (aucun accès base, aucun effet) : il transforme
   `?from&to` en `{ from, to, days, previousFrom, previousTo, isDefault }`. C'est la partie
   testable sans serveur, et c'est là que vivent les règles :
   - dates **civiles** (`YYYY-MM-DD`), vérifiées comme réelles (`2026-02-30` refusé) ;
   - arithmétique **UTC** (`shiftCivilDays`), donc insensible au fuseau du serveur et aux
     changements d'heure (même doctrine que T-232) ;
   - fenêtre bornée à 366 jours ; fin future ramenée à aujourd'hui (une période non finie ne doit
     pas afficher de zéros trompeurs) ;
   - période invalide → `{ error }`, que la page **rédige en clair** en retombant sur le défaut,
     et que la route d'export transforme en 400.
2. `src/lib/analytics.ts` : les agrégats sortent de la page et deviennent partagés. Motif : l'écran
   et l'export CSV doivent afficher **les mêmes nombres** — deux implémentations auraient divergé
   au premier correctif. Les formules sont reprises telles quelles (devise dominante, panier moyen
   par devise, occupation en nuits réelles, avis approuvés uniquement). Deux évolutions assumées :
   le top hébergements suit désormais la période, et la série journalière est bornée à 31 jours
   (l'export reste exhaustif).
3. `src/app/dashboard/analytics/page.tsx` devient une page d'affichage : sélecteur (deux champs
   `date` + Appliquer + Exporter en CSV) et libellés de cartes paramétrés par la durée réelle
   (`Revenus (30 j)` → `Revenus (N j)`), donc jamais menteurs si l'utilisateur change la période.
4. `GET /api/dashboard/analytics/export` : CSV sectionné (Résumé / Revenus par jour / Top
   hébergements), en-têtes localisés, devises séparées, protection anti-formule identique aux deux
   exports existants. Choix : **400** sur période invalide (action délibérée de l'utilisateur)
   plutôt qu'un fichier silencieusement faux.

## (c) F13 — première erreur seulement, champs inconnus acceptés en 200

**Décision : rendre la réponse plus riche sans casser la forme existante.**

- `zodIssues(error)` produit `[{ field, message }]` : le champ est le chemin Zod aplati
  (`cancellationReason`, `days.0.availableCount`…), les champs inconnus (`unrecognized_keys`)
  sont **éclatés** pour que l'UI puisse annoter chacun, et chaque libellé passe par la traduction
  existante — l'anglais Zod ne fuit jamais (contrainte T-159 conservée, test réécrit pour
  l'exiger).
- `zodErrorResponse(error, messageOverride?)` centralise la réponse 400. Les 20 routes qui
  répondaient `{ error: frenchZodMessage(...) }` l'utilisent ; `messageOverride` couvre le seul
  cas de libellé métier imposé (rotation des credentials).
- `.strict()` n'est posé que là où un champ inconnu signale une **erreur d'appel** ; avant de
  l'activer, les corps réellement envoyés par l'UI ont été relus un par un (réservation, profil,
  wishlists, messages, conversations, avis, disponibilité, plans tarifaires). Le cas d'école de
  l'audit — `PUT /api/bookings/[id]` avec `{ "paymentStatus": "paid" }` → 200 silencieux — renvoie
  désormais 400 avec `issues: [{ field: "paymentStatus", … }]`, sans qu'aucune écriture n'ait lieu
  (la validation précède toute lecture ou écriture métier).

## Tests ajoutés

| Fichier | Cas couverts |
|---|---|
| `src/lib/analytics-period.test.ts` (5) | défaut = 30 j + comparaison de même longueur ; période explicite (bornes incluses, 31 j) ; format/ordre invalides ; borne 366 j + fin future ; décalages UTC (changements d'heure, bissextile) |
| `src/app/api/bookings/[id]/route.t241.test.ts` (3) | champ inconnu → 400 + `issues` nommant le champ ; plusieurs champs fautifs → plusieurs `issues` traduits ; corps légitime toujours accepté (404, aucune écriture) |
| `src/app/api/admin/settings/[key]/route.test.ts` (réécrit) | `issues` présents, traduits, sans chemin interne — le contrat T-159 « pas de fuite anglaise » est conservé sous une nouvelle forme |
