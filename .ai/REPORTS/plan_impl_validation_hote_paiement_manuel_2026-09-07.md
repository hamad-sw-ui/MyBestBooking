# Plan d'implémentation non régressif — Validation hôte + paiement manuel (statuts à la main)

Date : 2026-09-07 · Niveau : **S** (stratégique — structurel, multi-rubriques) ·
Statut : **PLAN (à valider avant implémentation)**

## 1. Objectif métier (exprimé par l'utilisateur)

1. **L'inscription d'un hôte passe par la validation de l'admin** avant de pouvoir
   publier ses hébergements. L'admin fixe un **pourcentage (commission)** pour cet
   hôte, après l'avoir contacté / approuvé.
2. **Le client ne fait plus de paiement automatique** à la réservation (plus simple) :
   réservation = **demande** sans paiement en ligne.
3. Les **états de réservation** (en attente, confirmée, complétée, no-show, annulée)
   sont **gérés manuellement**, principalement par l'hôte.

## 2. Décisions d'option retenues (issues des clarifications)

| Option | Choix | Conséquence concrète |
|---|---|---|
| **Modèle paiement** | `manual_confirm` | Le client réserve sans payer en ligne → `booking.status = "pending"`. Le code Stripe/PSP **reste** mais n'est **plus déclenché automatiquement** à la création. Le montant est marqué « payé sur place » manuellement. |
| **Acteur des statuts** | `host_all` | L'hôte **confirme** (`pending→confirmed`), **complète** (`confirmed→completed`), **no-show** et **annule**. Le client peut **annuler** sa demande. L'admin garde la main en **arbitrage**. |
| **Priorité commission** | `host_override` | Nouveau champ `users.commissionRate`. Ordre : **propriété > hôte > global**. |
| **Gate hôte** | `block_publish` | Un hôte **non approuvé** peut **créer/soumettre** son hébergement mais il ne peut **jamais passer `active`** (double gate : hôte approuvé, puis propriété validée). |

## 3. État actuel (constat factuel sur le code)

- **Inscription** : `POST /api/auth/register` crée le user avec `role: "host"|"customer"`
  sans aucun statut d'approbation d'hôte. Il n'existe **pas** de champ
  `users.approvalStatus` ni `users.commissionRate`. Un hôte inscrit peut dès la
  connexion créer des hébergements (`POST /api/properties` → status `pending`) et
  les faire valider par l'admin (`/validate` → `active`).
- **Statut d'hébergement** : `properties.status ∈ {pending, active, draft, suspended}`.
  Passage à `active` **uniquement** via `POST /api/properties/[id]/validate`
  (`approve`), réservé admin. `POST /api/properties/[id]/submit` permet à l'hôte de
  re-soumettre un `draft`/`suspended`.
- **Commission** : `settings.defaultCommissionRate` (global, défaut 15) +
  `properties.commissionRate` (défaut 15). Le calcul se fait à la création du
  booking (`commissionRate = Number(property.commissionRate || "15")`) et dans
  `payout-service.ts` (agrégation pour versements). **Aucun taux par hôte**.
- **Paiement** : `POST /api/bookings` crée `status:"pending"` puis appelle
  `createPaymentIntentForBooking`. Le webhook Stripe `processPendingPaymentEvents`
  **auto-confirme** : `status:"succeeded"` & booking pending → `paymentStatus:"paid"`,
  `status:"confirmed"`, envoi de la confirmation.
- **Transitions de statut** (`src/lib/booking-lifecycle.ts`) : la machine à états
  (`pending → [confirmed, cancelled]`, `confirmed → [cancelled, completed, no_show]`).
  **L'hôte ne peut PAS confirmer** `pending→confirmed` : `transitionError` renvoie
  « Transition réservée à un administrateur » pour toute transition non
  cancelled/completed/no_show faite par un host. Le client ne peut qu'annuler.
- **UI** : `/dashboard/page.tsx` (hôte) liste les bookings ; `BookingRowActions`
  (vue voyageur + dashboard via `canManageStay`) gère annuler/clôturer/no-show ;
  `bulk/bookings-manager.tsx` (admin) gère les statuts en masse.
- **Tests** : `booking-lifecycle.test.ts`, `bookings/route.test.ts`,
  `bookings/[id]/route.test.ts`, `payout-service.test.ts`, `payment/index.test.ts`,
  `booking-cancellation-actor.test.ts`, `seed` etc. — plusieurs **attendent** un
  comportement d'auto-confirmation par paiement et un taux propriété fixe.

## 4. Principe directeur : NON-RÉGRESSION

- **Ajouts additifs uniquement** : nouveaux champs nullable/default (pas de
  suppression de colonne), nouvelles routes, nouvelles clés i18n.
- **Le code de paiement Stripe/PSP reste intact et est simplement désactivé au
  déclenchement automatique** : la route `/api/bookings/[id]/payment` et le webhook
  restent fonctionnels pour les cas legacy/back-office ; on **bascule par défaut**
  le flux de création vers « sans paiement en ligne ».
- **Le tunnel client ne casse pas** : la réservation se crée toujours, mais reste
  `pending` (au lieu de devenir `confirmed` via paiement auto).
- **Aucune régression des devises / payouts** : la logique de commission par devise
  (T-152/T-195) reste ; seul le **taux source** change (priorité hôte).

## 5. Étapes d'implémentation

### 5.0 — Migrations DB (additives, non destructrices)

**`drizzle/0019_*`** (généré via `drizzle-kit generate` après édition de `schema.ts`) :

```sql
ALTER TABLE "users"
  ADD COLUMN "approval_status" varchar(20) DEFAULT 'pending' NOT NULL,
  ADD COLUMN "commission_rate" numeric(10, 2);          -- NULL = hérite du global

ALTER TABLE "bookings"
  ADD COLUMN "payment_method_offline" boolean DEFAULT false NOT NULL,  -- "payé sur place"
  ADD COLUMN "confirmed_by" uuid;                        -- admin/hôte qui confirme
```

> ⚠️ `users.approval_status` : les comptes **seedés** (`admin`, `host`, `customer`)
> doivent être mis à `approved` (sinon l'hôte démo et l'hôte réel existant seraient
> bloqués). La migration **ne bloque pas** les hôtes existants : on règle
> `approval_status='approved'` pour tout `role='host'` déjà présent (préserver le
> comportement historique), et `pending` seulement pour les **nouveaux** hôtes.

### 5.1 — Approbation hôte + commission par hôte (flux admin)

**`src/db/schema.ts`**
- `users.approvalStatus: varchar(20).default("pending").notNull()`.
- `users.commissionRate: decimal(10,2)` (nullable).
- Type `HostApprovalStatus = "pending" | "approved" | "rejected"`.

**`src/app/api/admin/hosts/route.ts`** (nouvelle, admin-only)
- `GET /api/admin/hosts?status=pending` → liste des hôtes non approuvés
  (`users.role='host'`), avec nb de propriétés, date d'inscription, email.
- Enrichir `/dashboard/users` existant pour afficher la colonne `approval_status`
  des hôtes (via `UsersManager`).

**`src/app/api/admin/hosts/[id]/route.ts`** (nouvelle, admin-only)
- `PATCH` body `{ action: "approve"|"reject", commissionRate?: number }`.
- `approve` → `approvalStatus='approved'`, `commissionRate` si fourni (sinon null).
- `reject` → `approvalStatus='rejected'`.
- Garde : `commissionRate` ∈ [0,100], identifiant `uuid`.

**Audit** : `recordAudit` pour `host.approve` / `host.reject` (nouvelle action).

**Email outbox (best-effort)** : notifier l'hôte de son approbation + taux
(`templates.hostApproval`, clé i18n `mail.hostApproved`).

### 5.2 — Gate de publication (double gate hôte puis propriété)

**`src/lib/host-approval.ts`** (nouveau helper, réutilisé par les routes) :
```ts
export async function requireApprovedHost(userId: string): Promise<{ ok: true } | { ok: false; status: number; messageKey: string }>
```
- `ok` si `users.role==='host'` et `approvalStatus==='approved'`.
- `pending` → `403` + `host.pendingApproval` ; `rejected` → `403` + `host.rejected`.

**`src/app/api/properties/[id]/validate/route.ts`** — **point d'entrée du gate** :
- Avant `action==="approve"`, vérifier que le **propriétaire** du bien est un hôte
  approuvé. Si non → `409` + `host.notApprovedCannotPublish`. → un hébergement ne peut
  **jamais** passer `active` tant que l'hôte n'est pas approuvé.
- Ne change pas `reject`/`suspend`.

**`src/app/api/properties/route.ts` (POST)** : inchangé (l'hôte non approuvé **peut**
créer, status `pending`). Commentaire explicite.

**`src/app/api/properties/[id]/submit/route.ts`** : gate — si l'hôte n'est pas
approuvé, il peut créer mais le `pending` de la propriété ne débouchera sur rien ; on
ajoute un `409 + host.notApprovedCannotPublish` si l'hôte tente de soumettre alors
qu'il est `rejected` (mais on laisse `pending` tant que non bloquant).

### 5.3 — Commission : priorité propriété > hôte > global

**Helper `src/lib/commission.ts`** (nouveau) :
```ts
export async function resolveEffectiveCommissionRate(
  hostId: string,
  propertyRate: string | null | undefined,
): Promise<number>
```
- `propertyRate` si explicite (non-null) → sinon `user.commissionRate` si non-null →
  sinon `settings.defaultCommissionRate`.

**`src/app/api/bookings/route.ts`** : remplacer
`const commissionRate = Number(property.commissionRate || "15")` par
`resolveEffectiveCommissionRate(...)`.

**`src/lib/payout-service.ts`** : utiliser le taux effectif par (hôte, propriété)
dans l'agrégation (`commissionAmount`/`netToHost`).

> ⚠️ **Décision de non-régression** : `properties.commissionRate` **reste**
> prioritaire s'il est renseigné. Comme les propriétés existantes ont `15.00`, elles
> **gardent** leur taux (aucune régression). Pour qu'un hôte approuvé avec un taux
> hérite de son taux, la **création** de propriété pourra mettre `commissionRate`
> explicite seulement si l'admin le choisit ; par défaut la résolution retombe sur le
> taux hôte puis global. À trancher en revue (voir §8 – point ouvert).

### 5.4 — Paiement manuel (`manual_confirm`)

**`src/app/api/bookings/route.ts`** :
- Après `createdBooking`, **ne plus appeler** `createPaymentIntentForBooking` par défaut.
- Retourner `{ booking, payment: null, manualConfirmation: true }`.
- Conserver `paymentStatus: "pending"`, `paymentMethod: null`, `paymentIntentId: null`.
- Le booking reste `status: "pending"` (demande, pas paiement).

**`src/app/api/bookings/[id]/payment/route.ts`** : **conservé** (non-régressif) — permet
à un hôte/admin de déclencher un paiement en ligne explicite si nécessaire (back-office).

**`src/lib/payment-events.ts`** : **ne plus auto-confirmer** en `status:"succeeded"` :
garder `paymentStatus:"paid"` mais **ne pas** forcer `status:"confirmed"` (l'état reste
sous contrôle manuel). Nouvelle branche : si `paymentStatus:(paid)`, `status` reste tel
que décidé par l'hôte.

### 5.5 — Statuts manuels par l'hôte (`host_all`)

**`src/lib/booking-lifecycle.ts`** :
- Ajouter la transition **hôte** `pending → confirmed`.
- `customer` : reste seulement `cancelled` (inchangé).
- `host` : `pending → confirmed`, `confirmed → cancelled|completed|no_show`, `pending →
  cancelled`.
- `admin` : super-set (arbitrage, inchangé, autorise tout).

**`src/app/api/bookings/[id]/route.ts`** : l'acteur `host` est déjà rattaché (propriétaire
du bien). Garde déjà en place.

**Bouton « Confirmer » côté hôte** :
- `BookingRowActions` (dashboard, `canManageStay=true`) : ajouter un bouton
  **Confirmer** visible quand `status==='pending'` → `PUT /api/bookings/[id]
  { status:'confirmed' }`.
- Afficher l'état du paiement : badge « Payé sur place » si `paymentMethodOffline`.

### 5.6 — UI admin : approbation des hôtes

- `src/app/dashboard/users/page.tsx` + `UsersManager` : colonne `approval_status`
  + boutons **Approuver** (avec champ taux %) / **Rejeter** réservés aux hôtes.
- `src/app/dashboard/properties/page.tsx` : message si un bien appartient à un hôte
  non approuvé (« validation du compte hôte requise avant publication »).

### 5.7 — i18n (+clés FR/EN)

- `host.pendingApproval`, `host.rejected`, `host.notApprovedCannotPublish`,
  `dash.approveHost`, `dash.rejectHost`, `dash.hostCommission`,
  `book.confirmRequest`, `pay.manualConfirmed`, `status.manualPaid`,
  `mail.hostApproved` (~10 clés × 2 langues ≈ +20).

## 6. Tests

### Nouveaux
- `src/lib/host-approval.test.ts` — gate approuvé/pending/rejected.
- `src/lib/commission.test.ts` — priorité propriété > hôte > global.
- `src/app/api/admin/hosts/route.test.ts` — GET liste + PATCH approve/reject + taux.
- `src/lib/booking-lifecycle.test.ts` — + hôte `pending→confirmed`, `confirmed→
  completed` après départ, customer annule, admin arbitre.

### Adaptés (non régressifs — comportement intentionnellement modifié)
- `bookings/route.test.ts` : le POST ne doit **plus** attendre un `clientSecret`/
  auto-confirmation par défaut (vérifier `payment: null`, `status: "pending"`).
- `bookings/[id]/route.test.ts` : confirmer via l'hôte est désormais **autorisé**.
- `payment-events.test.ts` : pas de force de `status:"confirmed"` à `paid`.
- `seed` : hôtes seedés → `approved`.
- `payout-service.test.ts` : vérifier le calcul avec taux hôte.

## 7. Gates de fermeture

- 🔨 `tsc` 0 · `eslint` 0
- 🔍 `i18n:check` 0 (catalogue = 1462 + Δ)
- 🧪 `vitest` **tout vert** (396+ tests, aucune regression)
- 🔨 `build` 63 pages
- ▶️ `smoke` 95/95
- ✅ `ai:check` 19 OK · 0 fail

## 8. Points ouverts (à trancher en revue)

1. **Taux hôte vs propriétés existantes** : le `properties.commissionRate` étant rempli
   (`15.00`) par défaut sur toutes les propriétés, la priorité « hôte » ne prendrait
   effet que sur les **nouvelles** propriétés (ou celles où l'admin vide le taux).
   Proposition : rendre `properties.commissionRate` **nullable** et mettre `NULL`
   (« hérite ») pour les nouvelles créations, en gardant les valeurs existantes.
2. **Seed des hôtes** : confirmer que tous les hôtes de démo passent `approved`.
3. **Back-office paiement en ligne** : conserver la route `/api/bookings/[id]/payment`
   (oui, recommandé) — à confirmer.
4. **Le rôle `admin` peut-il créer une propriété sans gate ?** (actuellement oui →
   `active` direct). On garde ce comportement (non-régressif).

## 9. Estimation / découpage en livrables

- **J1** — Migrations + `host-approval` + routes admin hosts + gate validate.
- **J2** — Commission prioritaire + `commission.ts` + calcul booking/payouts.
- **J3** — Paiement manuel (bookings POST + payment-events) + tests adaptés.
- **J4** — Statuts manuels hôte (lifecycle + UI confirmer) + i18n + UI admin.
- **J5** — Gates complets + docs `.ai` + commit.

---
*Rapport de plan — à valider avant toute implémentation. Aucun code n'a été modifié
pour ce plan (aucun risque de régression introduit).*
