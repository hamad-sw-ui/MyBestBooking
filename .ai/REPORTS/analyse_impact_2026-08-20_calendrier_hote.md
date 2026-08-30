# Impact — T-018 : Éditeur calendrier hôte

- **Date** : 2026-08-20 · **Niveau** : **S** · **Ref** : §14

## Quoi
- Endpoints `/api/rooms/[id]/availability` : GET (calendrier), PUT (batch update).
- Endpoints `/api/rooms/[id]/rate-plans` : GET, POST, PATCH, DELETE.
- Page `/dashboard/rooms/[id]/calendrier` avec grille de dates éditable
  (prix override + stock override + stop-sell).
- Composant client `<AvailabilityCalendar>`.

## Où
- Nouveau `src/app/api/rooms/[id]/availability/route.ts`
- Nouveau `src/app/api/rooms/[id]/rate-plans/route.ts` (+ [rpId] pour PATCH/DELETE)
- Nouvelle page `src/app/dashboard/rooms/[id]/calendrier/page.tsx`
- Nouveau composant `src/components/availability-calendar.tsx`
- Aussi : lien depuis `/dashboard/rooms` vers cette page

## Contrat public
Nouveaux endpoints uniquement. Vérification ownership (host de la
property qui contient la room).

## Sécurité
Ownership vérifié. Batch update PUT limité à 90 jours d'un coup pour
éviter les payloads géants.

## Tests
Unitaire : validation UPSERT batch, contraintes de dates.
Manuel : ▶️ ajouter/retirer stop-sell, override prix, vérification en
base + affichage.

## Rollback
`git revert`. Table `room_availability` conserve les données saisies
mais aucune contrainte ne les impose.
