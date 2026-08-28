# T-129 — Analyse d'impact (§14) : restitution wallet/promo à l'annulation payée + cohérence capacité chambre (audit n°9)

- **Date** : 2026-08-28 · **Niveau** : **L** (pas de migration, pas de changement de contrat ; corrections de logique et de validation).
- **Origine** : `REPORTS/audit_fonctionnel_profond9_2026-08-28.md`.

## Périmètre

| Ref | Correctif | Fichiers |
|-----|-----------|----------|
| P1 | Restituer les crédits wallet et l'usage promo à l'annulation d'une réservation **payée** (comme c'est déjà fait pour l'expiration/échec). | `src/lib/booking-cancellation.ts` |
| P2 | Refuser des capacités de chambre incohérentes (`maxAdults > maxOccupancy`, `maxAdults+maxChildren > maxOccupancy`) → 400. | `src/app/api/rooms/route.ts` (+ `rooms/[id]` PUT s'il a un schéma), garde formulaire |
| P3 | Borner le prix de chambre (`basePrice > 0`) et la quantité (`≤ 99`). | `src/app/api/rooms/route.ts` |

## Les 9 questions (§14)

1. **Fichiers** : `booking-cancellation.ts` (1 ligne de logique), `rooms/route.ts` (`.refine()` Zod + message). Aucune dépendance nouvelle.
2. **Contrats d'API** : aucun champ modifié. P1 change un résultat (wallet correctement restitué) — c'est le correctif attendu ; les autres champs de réponse d'annulation sont identiques. P2/P3 ne changent que des codes pour des entrées invalides (400 au lieu de 201).
3. **Données** : aucune migration. `releaseBookingBenefits` utilise déjà `benefitsReleasedAt` (idempotence) et `GREATEST(currentUses-1,0)` ; aucune nouvelle colonne.
4. **Parcours (3 rôles)** :
   - Customer annulant une résa payée qui utilisait des crédits → wallet réaugmenté (et promo rendue), en plus du remboursement carte.
   - Customer annulant une résa impayée/expirée → comportement inchangé (restitution existante).
   - Hôte créant une chambre : capacités cohérentes requises (les vraies chambres ne sont pas affectées ; les données seed sont cohérentes).
5. **Composants critiques** : la réservation/paiement n'est pas modifiée. `releaseBookingBenefits` ne touche **pas** au PSP : le remboursement carte reste géré par `refundLateCapturedPayment` (garde `refundStatus`/`paymentIntentId`) — aucun double remboursement.
6. **Tests** :
   - Test unitaire pur de la condition d'annulation si on peut l'extraire ; sinon intégration par les tests d'annulation existants (`cancellation.test.ts`, `booking-lifecycle.test.ts`).
   - Le chemin `releaseBookingBenefits` (wallet restitué, promo décrémentée, idempotence) idéalement couvert par un test.
7. **Effets de bord** : la restitution wallet se fait dans la transaction `releaseBookingBenefits` déjà existante (`FOR UPDATE` sur la résa et l'utilisateur) ; pas de nouvel appel réseau.
8. **Risques de régression** :
   - **Double restitution wallet ?** Non : `releaseBookingBenefits` retourne `false` si `benefitsReleasedAt` est posé et pose ce marqueur en fin de transaction. Le cron de réconciliation et le webhook l'appellent aussi sans double effet.
   - **Résa payée sans wallet ni promo ?** `releaseBookingBenefits` ne fait que poser `benefitsReleasedAt` (0 wallet, pas de promo) → sans impact.
   - **Résa payée par wallet seul (total 0, paymentMethod "wallet")** : elle a `paymentStatus="paid"` et `paymentIntentId=null` → la branche PSP ne rembourse rien (pas d'intent), et `releaseBookingBenefits` restitue désormais les crédits. C'est le comportement attendu (le remboursement d'un achat 100 % crédits = rend des crédits).
   - P2 : ne valider qu'à l'écriture ; les chambres existantes (seed) sont déjà cohérentes → aucun rejet en lecture.
9. **Validation (§13)** : typecheck · lint · tests · build · smoke · ai:check · preuve d'exécution (annulation payée avec wallet → wallet restitué ; capacités incohérentes → 400 ; chambre valide → 201).

## Conception (§15.1)

- **P1** : remplacer `if (prepared.paymentStatus !== "paid") await releaseBookingBenefits(…)` par un appel **inconditionnel** `await releaseBookingBenefits(prepared.id)` après le traitement PSP (remboursement carte ou annulation d'intent). La fonction est idempotente et s'auto-protège.
- **P2/P3** : `roomSchema.refine(d => d.maxAdults <= d.maxOccupancy, …)` et `.refine(d => d.maxAdults + (d.maxChildren ?? 0) <= d.maxOccupancy, …)`, `basePrice: z.number().positive()`, `quantity: z.number().int().min(1).max(99).optional()`. Appliquer le même garde au PUT d'édition de chambre.

## Rollback
Révert du commit ; aucune migration.
