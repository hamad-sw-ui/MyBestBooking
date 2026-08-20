# Analyse d'impact — T-012 : Disponibilité + chevauchement bookings

- **Date** : 2026-08-20 (Session 5) · **Niveau** : **S** · **Ref** : §14

## 1. Quoi

`POST /api/bookings` doit refuser une création si :
- il existe déjà un booking non-annulé sur `(roomId, dates chevauchantes)` **ET**
- le nombre de bookings actifs atteint `room.quantity` sur les dates.

La vérification et l'insertion doivent être **atomiques** (transaction
Drizzle avec `SELECT ... FOR UPDATE`) pour éviter la race entre deux
requêtes concurrentes.

## 2. Où

- `src/app/api/bookings/route.ts` (POST)
- Nouveau `src/lib/availability.ts` (fonction pure `hasOverlap`)
- Nouveau `src/lib/availability.test.ts`
- Test intégration `src/app/api/bookings/route.test.ts`
- `src/db/schema.ts` : nouvel index `(roomId, checkIn, checkOut)` (perf)

## 3. Pourquoi

Feature 🎯 → ✅ tracée dans FEATURES.md § Réservation. PAR-002 exige
la disponibilité, PAR-001 exige la non-double-réservation.

## 4. Appelants

- Le POST /api/bookings est appelé depuis `/reservation` (tunnel).
- Aucun autre appelant.
- La nouvelle fonction `hasOverlap` sera aussi utile plus tard pour
  T-018 (calendrier hôte).

## 5. Contrat public

- Nouveau code de retour possible : **409 Conflict** avec
  `{ error: "Cette chambre n'est plus disponible pour ces dates" }`.
- Contrat auth/rôle inchangé.

## 6. Migration

- Ajout d'un index Drizzle (`idx_bookings_room_dates`) → migration
  `drizzle/0002_*`.

## 7. Sécurité

Aucun impact sécurité direct. Amélioration positive : évite un DoS par
double réservation (deux bookings sur la même room).

## 8. Test

- **Vitest unitaire** sur `hasOverlap(a, b)` : cas overlap total,
  overlap partiel début, overlap partiel fin, adjacent (check-out = check-in
  autorisé), disjoint.
- **Vitest intégration** sur POST /api/bookings : 1er booking OK, 2e
  overlap → 409, 2e après annulation du 1er → OK.

## 9. Rollback

`git revert` — restaure l'ancien comportement (bookings acceptés sans
check). Aucun state DB corrompu tant que la migration est idempotente.
