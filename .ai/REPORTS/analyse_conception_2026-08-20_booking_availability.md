# Conception — T-012

## Options

### A. Transaction Drizzle + SELECT FOR UPDATE (retenu)
```ts
await db.transaction(async (tx) => {
  const overlaps = await tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.roomId, data.roomId),
      not(eq(bookings.status, "cancelled")),
      // overlap : (a.checkIn < b.checkOut) AND (a.checkOut > b.checkIn)
      lt(bookings.checkIn, data.checkOut),
      gt(bookings.checkOut, data.checkIn),
    ))
    .for("update");

  if (overlaps.length >= room.quantity) throw ConflictError;

  await tx.insert(bookings).values({ ... });
});
```

**Avantages** : atomique, gère la concurrence, utilise `room.quantity`
pour multi-inventaire.
**Inconvénients** : requiert vraie transaction pg (déjà OK).

### B. Contrainte SQL EXCLUDE avec `tsrange` + `gist`
```sql
ALTER TABLE bookings ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (room_id WITH =, daterange(check_in, check_out) WITH &&);
```
**Rejeté** : très propre côté SQL mais nécessite extension `btree_gist`,
migration plus lourde, message d'erreur moins joli, moins compatible
avec `room.quantity > 1`.

### C. Advisory lock PostgreSQL
`pg_advisory_xact_lock(hashtext(roomId))` avant check.
**Rejeté** : plus obscur, gagne peu vs transaction + FOR UPDATE.

## Retenu : A avec ces raffinements

- Utiliser `not(eq(bookings.status, "cancelled"))` pour exclure les
  annulations.
- Comparaison stricte `<`/`>` (check-out d'un booking = check-in d'un
  autre = **autorisé**, standard hôtelier).
- Retour HTTP `409 Conflict` avec message français.
- Message d'erreur ne révèle pas combien de bookings existent (juste
  « pas disponible »).

## Plan

1. Créer `src/lib/availability.ts` avec `hasOverlap(a, b)` pur
2. Test unitaire dessus (5 cas).
3. Migration Drizzle : index `(roomId, checkIn, checkOut)`.
4. Réécrire POST bookings avec `db.transaction`.
5. Test intégration.
6. Mettre à jour FEATURES.md et BUGS.md (si applicable).
7. Commit.
