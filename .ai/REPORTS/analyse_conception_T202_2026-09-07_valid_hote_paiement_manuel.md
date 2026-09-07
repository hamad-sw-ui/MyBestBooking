# Analyse de conception T-202 — Validation hôte & paiement manuel (statuts à la main)

Date : 2026-09-07 · Type : **S** · Statut : **CONCEPTION (appliquée)**

## 1. Problèmes à résoudre
- Pas de statut d'approbation hôte → un hôte inscrit peut publier sans validation.
- Pas de taux de commission par hôte (seulement global + par propriété).
- Le client paie automatiquement à la réservation (webhook → `confirmed`).
- Les transitions `pending→confirmed` réservées à l'admin (pas à l'hôte).

## 2. Options évaluées et décisions

### 2.1 Approbation hôte
| Option | Choix | Justification |
|---|---|---|
| Nouveau champ `users.approvalStatus` | **retenu** | Additif, défaut `pending`, observable/filtrable, n'affecte pas les clients |
| `users.commissionRate` | **retenu** | Taux par hôte, nullable (hérite) |
| Réutiliser `properties.status` | rejeté | Le système (bien) est indépendant de l'approbation du compte hôte |

### 2.2 Gate de publication
- **Retenu** : `block_publish` — un hôte non approuvé peut **créer** (status `pending`)
  mais ne peut pas passer `active` (`/validate` → 409).
- Non régressif : l'admin (non-hôte) n'est jamais bloqué ; rejet/suspension inchangés.

### 2.3 Paiement manuel
- **Retenu** : `manual_confirm` — `POST /api/bookings` → `pending`, `payment:null`,
  `manualConfirmation:true`. La route `/api/bookings/[id]/payment` reste (back-office)
  et le champ `payOnline` (optionnel) permet de réactiver explicitement le paiement.
- **Webhook** : ne force plus `status:"confirmed"` à `paid` ; constate le paiement.
- Non régressif : réservation toujours créée (201), juste `pending`.

### 2.4 Statuts par l'hôte (`host_all`)
- `booking-lifecycle.ts` : ajoute la transition hôte `pending→confirmed`.
- Client : toujours `cancelled` uniquement. Admin : arbitre (super-set, inchangé).
- Route `bookings/[id]` : enregistre `confirmedBy` (hôte/admin) lors de la confirmation.

## 3. Modèle de données (migration 0019, additive)
```sql
ALTER TABLE "users"    ADD COLUMN "approval_status" varchar(20) DEFAULT 'pending' NOT NULL,
                       ADD COLUMN "commission_rate" numeric(10, 2);
ALTER TABLE "bookings" ADD COLUMN "payment_method_offline" boolean DEFAULT false NOT NULL,
                       ADD COLUMN "confirmed_by" uuid REFERENCES "users"("id");
```

## 4. Architecture des composants
- **Backend** :
  - `src/lib/host-approval.ts` — helper `getHostApprovalState` / `requireApprovedHost`.
  - `src/lib/commission.ts` — priorité propriété > hôte > global (`resolveCommissionRate` pure + `resolveEffectiveCommissionRate` DB).
  - `/api/admin/hosts` (GET liste) + `/api/admin/hosts/[id]` (PATCH approve/reject + %).
  - `/api/properties/[id]/validate` — gate `approve`.
  - `/api/bookings` — paiement manuel ; `/api/bookings/[id]` — `confirmedBy` ;
    `booking-lifecycle.ts` — `host_all`.
- **UI** :
  - `HostApproveActions` (admin), colonne dans `UsersManager`, bouton « Confirmer la
    demande » dans `BookingRowActions`.

## 5. Garanties de non-régression
- Colonnes additives, aucune suppression.
- Hôte démo seedé `approved` (comportement historique).
- Propriétés existantes gardent leur taux (priorité propriété > hôte).
- `payout-service` agrège `commissionAmount` déjà stocké (taux appliqué à la création).
- Route `/api/bookings/[id]/payment` conservée (back-office).
- Tests existants inchangés dans leur intention (`bookings/route.test` 8/8, etc.).

## 6. Sécurité / contrôles
- Les routes `/api/admin/hosts` et `[id]` exigent `user.role === "admin"` (403 sinon).
- `commissionRate` validé ∈ [0,100] (Zod).
- Gate `validate` : `requireApprovedHost` retourne un message explicite (pending/rejected).
- Audit `host.approve` / `host.reject` journalisé.

## 7. Points ouverts (backlog)
- UI hôte de re-soumission après `rejected` (affiner le parcours).
- Notifier l'hôte par e-mail à l'approbation (outbox) — best-effort non bloquant.
- Le champ `payOnline` reste optionnel ; à exposer dans un back-office si besoin.
