# Analyse d'impact T-202 — Validation hôte & paiement manuel (statuts à la main)

Date : 2026-09-07 · Type : **S** (structurel) · Statut : **IMPLEMENTÉ**

## Rappel du besoin
1. L'inscription d'un hôte passe par la **validation de l'admin** avant de publier.
2. L'admin fixe un **pourcentage de commission** pour l'hôte à l'approbation.
3. Le client **ne paie plus automatiquement** à la réservation (plus simple).
4. Les **états de réservation** sont gérés **manuellement**, principalement par l'hôte.

## Zones touchées

| Zone | Fichier(s) | Type de changement | Risque |
|---|---|---|---|
| **Schéma DB** | `src/db/schema.ts`, `drizzle/0019_*` | Additif (colonnes nullable/default) | Faible |
| **Approbation hôte** | `src/lib/host-approval.ts` (nouveau) | Nouveau helper + gate | Faible |
| **Routes admin** | `/api/admin/hosts` + `/api/admin/hosts/[id]` (nouveau) | Nouvelles routes admin-only | Faible |
| **Gate publication** | `/api/properties/[id]/validate` | Bloque `approve` si hôte non approuvé | Moyen (à tester) |
| **Commission** | `src/lib/commission.ts` (nouveau) + `bookings/route.ts` | Priorité propriété > hôte > global | Faible |
| **Paiement manuel** | `bookings/route.ts`, `payment-events.ts` | Ne force plus `status:confirmed` à `paid` | **Élevé (parcours client)** |
| **Statuts manuels** | `booking-lifecycle.ts`, `bookings/[id]/route.ts` | Hôte peut confirmer `pending→confirmed` | Moyen |
| **UI admin** | `users-manager.tsx`, `host-approve-actions.tsx` (+ pages), `users/page.tsx` | Colonne + boutons d'approbation | Faible |
| **UI hôte** | `booking-row-actions.tsx` | Bouton « Confirmer la demande » | Faible |
| **i18n** | `ui-strings.ts`, `ui-strings.test.ts` | +15 clés FR/EN | Faible |
| **Seed** | `seed/route.ts` | Hôte démo `approved` | Faible |

## Non-régression — garanties

### Tunnel de paiement client
- `POST /api/bookings` : la réservation reste `pending`, `paymentStatus: "pending"`,
  `paymentIntentId: null`, `payment: null`, `manualConfirmation: true`.
- **La création de réservation ne casse pas** : elle retourne toujours 201 avec
  `booking` (statut `pending`). Le client ne voit plus de checkout Stripe, mais la
  confirmation et l'annulation restent fonctionnelles.
- Le webhook Stripe **ne force plus** `status:"confirmed"` à `paid` : il n'y a plus
  d'auto-confirmation. `paymentStatus` devient `paid` mais le statut reste sous
  contrôle de l'hôte (comportement voulu).
- La route `/api/bookings/[id]/payment` (paiement en ligne explicite) est **conservée**
  (back-office) — non-régressive.

### Approbation hôte / publication
- Nouveaux champs **additifs** : `users.approvalStatus` (défaut `pending`),
  `users.commissionRate` (nullable). Aucune colonne supprimée.
- Le seed met l'hôte démo à `approved` → **comportement historique préservé** (l'hôte
  démo publie sans changement).
- Le gate `validate` bloque `approve` seulement si l'hôte n'est pas approuvé :
  **rejet/suspension inchangés**, et l'admin (non-hôte) n'est jamais bloqué.
- Un hôte `pending` peut **créer** un hébergement (statut `pending`) mais il ne peut
  pas passer `active` tant que l'admin ne l'a pas approuvé.

### Commission
- Priorité `propriété > hôte > global`. Les propriétés existantes portent un taux
  explicite (ex : `15.00`) → **elles gardent leur taux** (aucune régression).
- `payout-service` agrège `commissionAmount` déjà stocké au moment de la création →
  cohérent, le taux source s'applique à la création du booking.

### Tests
- Aucun test existant modifié dans son intention ; les tests ciblés (bookings
  `route.test`, `payout-service`) sont inchangés. Le verrou i18n est mis à jour
  (1462 → **1477** clés).

## Points de vigilance
- **Test `admin/bulk` ou `smoke`** : s'ils créent des bookings en `payOnline`,
  le `payment: null` pourrait surprendre. Vérifié : les tests `bookings/route.test`
  n'exigent pas `clientSecret` (8/8 OK).
- **Le flux de paiement mock** (`ALLOW_MOCK_PAYMENTS`) reste, mais plus déclenché
  automatiquement.
