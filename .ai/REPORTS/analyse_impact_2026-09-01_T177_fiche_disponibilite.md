# Analyse d'impact — T-177 disponibilité réelle des chambres sur la fiche

- **Date** : 2026-09-01
- **Tâche** : T-177
- **Niveau** : S (affichage conditionnel — rendu historique intact hors dates)

## Problème (prouvé à l'exécution)

Fiche `/hebergement/[slug]?checkIn=2026-12-01&checkOut=2026-12-04` : même
rendu qu'en dates libres alors que la chambre était épuisée (6 réservations
confirmées = quantities). L'échec 409 « plus disponible » survenait **après
tout le tunnel** (formulaire + préparation de paiement). Rapport complet :
`audit_execution_2026-09-01_T177_fiche_disponibilite.md`.

## Surface impactée

- `src/lib/room-remaining.ts` (nouveau, pur) + `room-remaining.test.ts`
  (6 tests : plancher 0, garde d'entrée, jumeau des règles).
- `src/app/(main)/hebergement/[slug]/page.tsx` : comptage d'occupation par
  `GROUP BY` (1 requête bornée, uniquement si séjour valide) + branche
  conditionnelle dans la carte chambre (`Complet` désactivé / `Réserver`).
- `src/lib/ui-strings.ts` : +1 clé `room.soldOut` FR/EN (catalogue **1421**).
- `src/lib/ui-strings.test.ts` : compteur 1420→1421.

## Risques & garde-fous

- Performance fiche : requête ajoutée **uniquement si dates validées** ;
  hors dates ou invalides : `stayDates` null → **aucun SQL supplémentaire**.
- Faux « Complet » : les prédicats SQL sont verbatim ceux de la garde
  (T-157) — testé en vrai : l'avertissement apparaît bel et bien à partir
  du seuil réel 6/6, ailleurs jamais.
- Stale read : acceptable (lecture indicative ; l'API reste la validation
  définitive avec verrous `FOR UPDATE`).
- Multi-chambres d'une propriété : chacune évaluée isolément (seule la
  chambre épuisée affiche « Complet »).

## Preuves attendues

tsc · eslint · vitest complet (456) · build prod (60/60) · runtime 4 cas ·
smoke 94/94 · i18n:check · ai:check.
