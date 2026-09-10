# Analyse — commission par hôte, dépôt d'avis client, gestion manuelle des statuts de réservation

- **Date** : 2026-09-10
- **Dépôt** : `MyBestBooking` (Next.js 16 App Router / React 19 / PostgreSQL / Drizzle ORM)
- **Branche analysée** : `arena/01a08b7d-mybestbooking` @ `645a0cf`
- **Demande** : répondre à trois questions et, en cas de manque, fournir un **plan
  d'implémentation non régressif** :
  1. l'admin peut-il changer le **pourcentage de commission de chaque hôte** depuis la page
     `/dashboard/users` ?
  2. les **clients** peuvent-ils **saisir leurs avis** ?
  3. l'admin ou un hôte peut-il, dans sa page **Réservations**, faire la **gestion manuelle des
     états** d'une réservation **dans la colonne Statut** ?

## 0. Méthode et environnement de preuve

Analyse statique de la surface réelle (`src/app/api`, `src/app/dashboard`, `src/components`,
`src/lib`, `src/db/schema.ts`) **puis vérification runtime** sur l'application lancée :

| Élément | Valeur |
|---|---|
| Base | PostgreSQL embarqué (`npm run db:dev`) sur `127.0.0.1:55432`, base `app_db`, schéma appliqué via `npx drizzle-kit push` |
| Seed | `POST /api/seed` → 8 hébergements, comptes `admin@ / host@ / customer@mybestbooking.com` |
| Serveur | `next dev -H 0.0.0.0 -p 3000` (Turbopack), `NODE_ENV=development` |
| Tests | `npx vitest run` (unitaires + intégration live `:3000`) |
| Outils | `curl` + analyse DOM/HTML, requêtes SQL directes (`pg`) |

> Les documents `.ai/ARCHITECTURE.md`, `.ai/DATABASE.md`, `.ai/MISSION.md` décrivent un **ancien
> projet Android/Kotlin (MobileCaisse)** : ils ont été ignorés. Toutes les conclusions ci-dessous
> proviennent du code **réel** de MyBestBooking (`src/app`, `src/components`, `src/db`, `src/lib`).

## 0.bis Synthèse (réponses courtes)

| # | Question | Réponse | Détail |
|---|---|---|---|
| 1 | L'admin peut-il changer la commission **de chaque hôte** dans `/dashboard/users` ? | **NON** pour un hôte déjà `approved` (partiel : seulement au moment de l'approbation ou re-approbation d'un hôte `rejected`) | Plan non régressif § 1.5 |
| 2 | Les clients peuvent-ils **saisir leurs avis** ? | **OUI** — parcours complet testé de bout en bout (page + API 201) | Preuves § 2.2 ; limites annexes § 2.4 |
| 3 | Admin/hôte : gestion manuelle des états **dans la colonne Statut** de la liste des réservations ? | **NON en liste** (badge seul) ; **OUI sur la page détail** de la réservation | Plan non régressif § 3.3 |

---

## 1. Q1 — Commission par hôte dans la page Utilisateurs

### 1.1. Réponse

**Non.** Pour un hôte **approuvé**, l'admin **ne peut pas** saisir/modifier son pourcentage de
commission depuis `/dashboard/users`. Le champ de commission n'est affiché qu'au moment de
l'approbation (hôte `pending`) ou de la ré-approbation (hôte `rejected`). Une fois l'hôte
`approved`, la seule action restante est « Rejeter l'hôte ».

### 1.2. Ce qui existe réellement

| Surface | Comportement actuel |
|---|---|
| `/dashboard/users` (admin) | Colonne « hôte » : badge `approved/pending/rejected` + `{commissionRate}%` en **lecture seule** + `<HostApproveActions>` |
| `src/components/admin/host-approve-actions.tsx` | L'input « Commission » est rendu **uniquement si `canApprove`** (statut `pending` **ou** `rejected`). Pour `approved`, seuls `Rejeter` (et l'éventuel message d'erreur) sont rendus |
| `PATCH /api/admin/hosts/[id]` | `z.object({ action: z.enum(["approve","reject"]), commissionRate?: 0-100 })` ; le taux n'est **écrit que si `action === "approve"`** |
| `src/lib/commission.ts` | Priorité d'application : **propriété > hôte > global** (`settings.billing.defaultCommissionRate`, défaut 15) |
| `/dashboard/properties/[id]` (admin) | `commissionRate` **par hébergement** est éditable (T-145) et **prime** sur le taux hôte |

### 1.3. Preuves

**Statiques** — `src/components/admin/host-approve-actions.tsx` :

```tsx
const canApprove = isPending || isRejected;   // ← rien pour un hôte approved
...
{canApprove && ( <> <input type="number" ... placeholder={t("dash.hostCommission")} /> ... </> )}
```

`src/app/api/admin/hosts/[id]/route.ts` :

```ts
const schema = z.object({ action: z.enum(["approve", "reject"]), commissionRate: ... });
...
...(isApprove && data.commissionRate !== undefined ? { commissionRate: data.commissionRate.toFixed(2) } : {}),
```

**Runtime** (API admin, seed en place) :

| Vérification | Résultat |
|---|---|
| `GET /dashboard/users` (admin, seed = **1 hôte `approved`**) | 200 — **0** `input[type=number]` dans toute la page ; la ligne de l'hôte n'expose que `Rejeter l'hôte` / `Suspendre` |
| Contre-épreuve (hôte de test laissé en `pending` par un test d'intégration) | La page affiche alors **1** `input[type=number]` (champ commission) → le champ n'existe **que** pour `pending`/`rejected` |
| Vérifié aussi sur le **build de production** (`next build` + `next start -p 3100`) | Même résultat : 0 champ commission pour l'hôte `approved` |
| État en base | `host@mybestbooking.com` → `approval_status = 'approved'`, `commission_rate = NULL` |
| `PATCH /api/admin/hosts/<id>` `{"action":"approve","commissionRate":12}` sur un hôte **déjà approuvé** | **200** → `commissionRate: "12.00"` (puis restauré à `NULL`) : l'API *peut* écrire le taux, **l'UI ne l'expose pas** |
| `PATCH` `{"action":"approve","commissionRate":150}` | 400 « Valeur trop grande » |
| `GET /api/admin/hosts` | `propertyCount: 0` alors que la base contient **8** hébergements pour cet hôte → **bug annexe** (voir § 1.4.2) |

**Effet métier d'un changement de taux hôte** : les 8 hébergements du seed portent tous un
`commission_rate = 15.00` explicite. Comme la **propriété prime sur l'hôte**, modifier
`users.commissionRate` **ne change rien** pour ces biens : seuls les hébergements dont
`commission_rate IS NULL` héritent du taux hôte. Un réglage « hôte » sans indicateur d'impact
serait donc trompeur.

### 1.4. Causes racines et écarts annexes

1. **Cause racine fonctionnelle** : le taux hôte a été conçu (T-202) comme un attribut **d'approbation**
   et non comme un attribut **éditable** ; aucune action API dédiée n'existe et l'UI le cache
   volontairement (`canApprove`).
2. **Bug annexe détecté — `propertyCount` toujours à 0** (`src/app/api/admin/hosts/route.ts:49`) :

   ```ts
   propertyCount: sql<number>`(SELECT count(*)::int FROM properties WHERE properties.host_id = ${users.id})`
   ```

   Drizzle sérialise `${users.id}` **sans qualification** (`"id"`) car la requête est mono-table.
   Dans la sous-requête, `"id"` se résout alors sur **`properties.id`** → `host_id = id` est
   toujours faux → `0`. Preuve : `q.toSQL()` → `... WHERE properties.host_id = "id"` ; en base,
   `SELECT count(*) FROM properties WHERE host_id = <hôte>` renvoie **8**.
   Conséquence : l'admin approuve un hôte en croyant qu'il n'a **aucun** hébergement à publier
   (alors que la docstring de la route annonce l'inverse).
3. **Aucun retour à l'héritage** : l'API ne permet pas de remettre `users.commissionRate` à `NULL`
   (hérite du global).
4. **Aucune trace d'audit dédiée** : une modification de taux passerait par `host.approve`
   (`AUDIT_ACTIONS.hostApprove`), ce qui fausse l'historique d'approbation.

### 1.5. Plan d'implémentation non régressif (Q1)

**Principe directeur** : n'ajouter qu'une **action additive** `updateCommission`, laisser intact
le couple `approve/reject` (API et tests existants), ne jamais recalculer une réservation passée
(les montants sont figés dans `bookings.commissionRate / commissionAmount / netToHost`), et rendre
**explicite** l'effet réel via un **aperçu d'impact** avant toute propagation.

#### Lot 0 — Corriger `propertyCount` (prérequis, 1 fichier)

- `src/app/api/admin/hosts/route.ts` : qualifier la colonne —
  `(SELECT count(*)::int FROM properties WHERE properties.host_id = "users"."id")`
  (ou, variante plus robuste : agrégat séparé
  `select host_id, count(*) from properties group by host_id` puis fusion en JS).
- **Tests** : dans `src/app/api/admin/hosts/route.test.ts`, après la création d'un hébergement par
  `host2` (bloc « gate de publication »), vérifier `propertyCount === 1` dans la réponse
  `GET /api/admin/hosts?status=pending`.
- **Non-régression** : les 5 tests existants du fichier doivent rester verts (vérifié : 5/5 avec
  serveur live, cf. Annexe A). **Au passage**, corriger le nettoyage `afterAll` de ce fichier : il
  appelle `POST /api/admin/bulk?action=deleteUser&ids=…` avec un corps vide, alors que la route
  attend `{ entity, action, ids }` → l'appel échoue silencieusement et les hôtes de test
  s'accumulent en base (constaté : 2 hôtes `@test.local` + 1 hébergement restants après un run).

#### Lot 1 — API : action `updateCommission`

- `src/app/api/admin/hosts/[id]/route.ts` : remplacer le schéma par une **union discriminée
  rétro-compatible** :

  ```ts
  z.discriminatedUnion("action", [
    z.object({ action: z.literal("approve"), commissionRate: z.number().min(0).max(100).optional() }),
    z.object({ action: z.literal("reject") }),
    z.object({ action: z.literal("updateCommission"),
               commissionRate: z.number().min(0).max(100).nullable() }), // null = héritage global
  ])
  ```

- Garder : admin only (403), cible `role === "host"` (400), 404 si introuvable, messages FR via
  `apiError` + `frenchZodMessage`.
- Écrire `commissionRate.toFixed(2)` (cohérent avec le type `decimal(4,2)`), ou `NULL` si `null`.
- **Audit dédié** : `src/lib/audit.ts` → `commissionUpdate: "host.commission.update"`, avec
  `metadata: { hostId, previousRate, newRate }` (l'action `host.approve` reste réservée à
  l'approbation).
- **Compatibilité** : `approve` conserve son champ optionnel → aucun breaking change pour les
  appelants/tests actuels.
- **Tests** (`src/app/api/admin/hosts/route.test.ts`) : nominal (12 → 20, relu par `GET`),
  héritage (`null`), bornes (101 / -1 → 400), rôles (403 pour `host`/`customer`),
  audit (`audit_log` contient `host.commission.update`).

#### Lot 2 — Propagation opt-in aux hébergements (répond au « ça ne change rien »)

- Nouveau champ optionnel sur la même action : `applyTo?: "inherited" | "listed"` +
  `propertyIds?: string[]` (max 100, UUID) — **jamais** de propagation implicite « tout ».
- `applyTo: "inherited"` : ne met à jour que les biens `commission_rate IS NULL` (ceux qui
  héritent réellement).
- `applyTo: "listed"` : met à jour **uniquement** les `propertyIds` transmis, après une
  **évaluation d'impact** exposée par un `GET /api/admin/hosts/[id]/commission-preview`
  (dry-run) qui renvoie, pour cet hôte : nb d'hébergements au taux explicite, nb héritant,
  taux effectif par bien, et le **taux effectif global actuel**.
- Chaque écriture de bien est auditée (`metadata: { propertyId, previousRate, newRate, reason }`).
- **Interdit explicitement** : recalculer `bookings.commissionRate/Amount/netToHost` d'une
  réservation existante (source de régression financière + ADR-009).
- **Tests** : la preview ne modifie rien (re-lecture base) ; `inherited` ne touche que les `NULL` ;
  `listed` ne touche que la liste ; un `booking` existant conserve ses montants.

#### Lot 3 — UI admin `/dashboard/users`

- Nouveau composant client `src/components/admin/host-commission-editor.tsx` :
  - affiche le taux hôte (`12,00 %`) ou « Hérite : 15 % (global) » si `NULL`,
  - bouton `Modifier` → input `type="number"` (`min=0`, `max=100`, `step=0.01`, virgule acceptée),
    `Enregistrer` / `Annuler`,
  - affiche le **rappel d'impact** (« 8 hébergements sur 8 portent un taux spécifique — ce
    réglage ne les modifie pas ») et, si `applyTo` est utilisé, une confirmation explicite.
  - toast succès/erreur (`useToast`) + `router.refresh()`.
- `src/components/admin/host-approve-actions.tsx` : **retirer** l'input commission intégré (il
  devient redondant) **ou** le déléguer au nouveau composant — au choix, mais une seule source de
  saisie. Les boutons Approuver/Rejeter et leur flux restent identiques.
- `src/components/bulk/users-manager.tsx` : rendre la cellule « commission » cliquable/éditable
  pour **tous les hôtes** (indépendamment du statut).
- **i18n** : nouvelles clés FR + EN dans `src/lib/ui-strings.ts`
  (`dash.hostCommissionEdit`, `dash.hostCommissionInherit`, `dash.hostCommissionUpdated`,
  `dash.hostCommissionImpact`, `dash.hostCommissionApplyInherited`, …). Le type
  `UiStringKey = keyof typeof FR` contraint la parité EN **à la compilation**.
- **Accessibilité** : `<label>` associé, `aria-label`, message d'erreur `role="alert"`.

#### Lot 4 — Traçabilité et documentation

- Vérifier l'affichage de la nouvelle action dans `/dashboard/audit` (mapping des libellés).
- Mettre à jour dans le **même commit** : `.ai/API.md` (route modifiée), `.ai/FEATURES.md`,
  `.ai/STATE.md`, `.ai/TRACEABILITY.md`, et `.ai/KNOWN_LIMITATIONS.md` (retirer la limitation si
  elle y est décrite), conformément à `.ai/CHECKLISTS/avant_commit.md` §11/§22.

#### Risques et garde-fous (Q1)

| Risque | Garde-fou |
|---|---|
| Régression de `approve`/`reject` | Union discriminée ; `approve` + `commissionRate` conservés ; tests existants inchangés |
| Silence métier (le taux hôte ne s'applique pas aux biens à taux explicite) | Aperçu d'impact obligatoire + propagation opt-in explicite |
| Régression financière | Aucune écriture sur `bookings` ; snapshots historiques intouchables |
| Perte de l'état « hérite du global » | `commissionRate: null` supporté par `updateCommission` |
| Double saisie UI (ancien + nouvel input) | Un seul composant de saisie rendu |
| Perte d'audit | Action dédiée + `metadata` ancien/nouveau + `audit_log` testé |

#### Critères d'acceptation (Q1)

1. Un admin peut modifier le taux d'un hôte **`approved`** depuis `/dashboard/users` ; la valeur
   persiste après rechargement.
2. Le taux peut être remis en **héritage global** (affiché « hérite : X % »).
3. L'aperçu d'impact est visible **avant** toute propagation ; rien n'est propagé sans action
   explicite.
4. Aucune réservation existante n'est recalculée (contrôle SQL avant/après).
5. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run i18n:check` verts ;
   tests d'intégration live verts.
6. Une entrée `host.commission.update` est créée par modification.

#### Décisions à valider avant implémentation

- **D1** : la propagation aux hébergements doit-elle exister dès la V1, ou seulement le rappel
  d'impact (Lot 2 = optionnel) ?
- **D2** : « hériter » doit-il rester possible alors que T-202 semble privilégier un taux par hôte
  explicite ?
- **D3** : un taux hôte modifié doit-il s'appliquer aux hébergements **sans propriétaire hôte
  approuvé** (cas limites) ?

---

## 2. Q2 — Dépôt d'avis par les clients

### 2.1. Réponse

**Oui — la fonctionnalité existe, elle est complète et fonctionne de bout en bout.** Aucun plan
correctif n'est nécessaire.

### 2.2. Parcours et preuves runtime (dépôt réel effectué)

| Étape | Preuve |
|---|---|
| Le voyageur termine un séjour → CTA | `/mes-reservations` affiche « **Laisser un avis** » pour chaque réservation `completed` sans avis (compte `hugo.durand@email.com`, 3 séjours terminés non commentés → **3 liens** `href="/mes-reservations/avis/<bookingId>"`) |
| Ouverture du formulaire | `GET /mes-reservations/avis/<bookingId>` → **200**, titre « Laisser un avis », `<form>` présent, 2 zones de commentaire, 7 `input[type=range]` (note globale + sous-notes T-115) |
| Dépôt | `POST /api/reviews {"bookingId":…,"overallRating":9,"positiveComment":"…"}` → **201** (statut `approved` par défaut : `settings.reviews.requireModeration = false`) |
| Anti-doublon | Second `POST` → **400** « Vous avez déjà laissé un avis pour cette réservation » (contrainte `reviews.bookingId` unique + verrou `FOR UPDATE`) |
| Relecture | Rechargement de la page → **200**, h1 « Vous avez déjà publié un avis pour cette réservation. » (T-152) |

> L'avis de test a été supprimé et l'agrégat de la propriété recalculé après la vérification
> (base de dev laissée dans son état de seed).

### 2.3. Garde-fous en place

- **Éligibilité** : `isReviewEligible(status === "completed" && checkOut <= aujourd'hui)` — vérifiée
  côté page (RSC) **et** côté API (400 sinon).
- **Propriété** : `booking.userId === user.id` (403 sinon) ; `bookingId` unique ; rate-limit
  `20 avis / heure / utilisateur`.
- **Modération** : option admin `reviews.requireModeration` (sinon publication immédiate).
- **Clôture automatique du séjour** : le cron quotidien `/api/cron/price-alerts` (08:00,
  `vercel.json`) exécute `completeEligibleBookings()` sur les réservations
  `confirmed + paid + checkOut ≤ aujourd'hui` → l'avis ne dépend **pas** d'une action de l'hôte
  pour un séjour payé.
- **Relance e-mail** : `sendReviewRequests()` envoie un e-mail de demande d'avis (fenêtre 14 jours,
  `notifications.reviewRequest`, `eventKey = review-request:<bookingId>` — idempotent).

### 2.4. Limites observées (facultatif, hors demande — aucun plan requis)

1. **Pas d'édition ni de suppression** d'un avis par son auteur : `src/app/api/reviews/[id]/` ne
   contient que `helpful/`, `moderate/`, `reply/` (pas de `route.ts` PUT/DELETE).
2. **Pas de fenêtre de dépôt** : la page accepte un avis **n'importe quand** après le départ ; seul
   l'e-mail de relance est borné à 14 jours.
3. **Dépendance au règlement** : `markPaidOffline` (hôte/admin) reste nécessaire pour que le cron
   clôture un séjour — sans paiement constaté, pas d'avis possible.
4. **Détail technique mineur** : sur identifiant non éligible/malformé, la page rend le contenu
   404 mais répond **HTTP 200** — reproduit en `next dev` **et sur le build de production**
   (`next start` : `…/avis/<uuid-inconnu>`, `…/avis/pas-un-uuid`, réservation non éligible →
   `200` + HTML 404). Sans impact fonctionnel ; à corriger si un statut HTTP strict importe
   (SEO/robots).

---

## 3. Q3 — Gestion manuelle des états dans la liste des réservations

### 3.1. Réponse

**Non dans la colonne** : dans `/dashboard/bookings` (vue hôte **et** vue admin), la colonne
« Statut » n'affiche qu'un **badge** (lecture seule), suivi d'un lien « œil » vers le détail.
**Oui sur la page détail** `/dashboard/bookings/[id]` : les actions manuelles existent
(confirmer une demande, constater un paiement, terminer le séjour, no-show, annuler).

### 3.2. Preuves

- `src/components/bulk/bookings-manager.tsx` : en-têtes `{t("dash.colStatus")}` puis
  `{t("bulk.colActions")}` ; la cellule statut ne contient que `<Badge>` ; la cellule actions ne
  contient que le lien `Eye`. Aucun `<select>`/`<input>` de statut.
- `src/app/dashboard/bookings/page.tsx` : le conteneur serveur ne transmet que `bookings` et
  `isAdmin` ; aucune notion de transitions disponibles.
- **Runtime** (33 réservations) :

  | Vue | Colonnes | Cellule statut |
  |---|---|---|
  | Hôte | 7 `td` | texte seul (« Confirmée ») |
  | Admin | 8 `td` (checkbox bulk en 1ʳᵉ colonne) | texte seul (« Confirmée ») — la seule `<input>` de la ligne est la case à cocher |

- Ce qui existe **hors liste** :
  - `src/components/booking-row-actions.tsx` (page détail) : `pending → confirmed` (T-202),
    `markPaidOffline` (T-203), `confirmed → completed | no_show` (T-130), `cancelled` (annulation
    sans frais côté hôte/admin, T-156).
  - Bulk admin : **annulation uniquement**, via la case à cocher + `BulkToolbar` (pas d'action
    groupée pour l'hôte).
- **Source de vérité serveur** : `src/lib/booking-lifecycle.ts` (`transitionError`) avec
  `pending → [confirmed, cancelled]`, `confirmed → [cancelled, completed, no_show]`,
  `cancelled|completed|no_show → []` (états terminaux), plus :
  - `completed` refusé (409) tant que `paymentStatus !== "paid"` ;
  - `completed`/`no_show` par l'hôte uniquement après `checkOut` ;
  - le voyageur ne peut qu'annuler ; l'admin suit la même table de transitions.
- **Trou de traçabilité constaté** : dans `src/app/api/bookings/[id]/route.ts`, `recordAudit` n'est
  appelé que pour `markPaidOffline`. Les changements de **statut** ne laissent **aucune trace**
  dans `audit_log`.

### 3.3. Plan d'implémentation non régressif (Q3)

**Principe directeur** : **aucune nouvelle route** — l'édition en ligne réutilise
`PUT /api/bookings/[id]` (FSM, transaction + verrou, e-mails, fidélité, remboursements déjà en
place). On ajoute uniquement (a) un **calcul partagé des transitions autorisées** pour l'UI et
(b) un composant client léger dans la cellule.

#### Lot 1 — Helper « transitions disponibles » (partagé UI/serveur)

- `src/lib/booking-lifecycle.ts` : ajouter une fonction **pure** dérivée de `transitionError` :

  ```ts
  export function availableTransitions(input: {
    current: BookingStatus; actor: BookingActor;
    checkOut: string | Date; paymentStatus?: string | null; today?: string;
  }): BookingStatus[]
  ```

  Règle : parcourir `transitions[current]` et conserver `next` si `transitionError(...) === null`
  **et** si `next !== "completed" || paymentStatus === "paid"` (pour éviter un 409 prévisible).
- Le serveur **ne change pas** : `PUT` continue d'appeler `transitionError` (source unique de
  vérité). L'UI ne fait que **ne pas proposer** l'impossible.
- **Tests unitaires** (`src/lib/booking-lifecycle.test.ts`) : matrice
  `statuts × acteurs (customer/host/admin/system) × date × paiement` — dont :
  hôte/`pending` → `[confirmed, cancelled]` ; hôte/`confirmed` payé après départ →
  `[completed, no_show, cancelled]` ; hôte/`confirmed` **non payé** → pas de `completed` ;
  admin/`cancelled` → `[]` ; voyageur/`confirmed` → `[cancelled]`.

#### Lot 2 — Composant client `BookingStatusSelect`

- Nouveau fichier `src/components/bulk/booking-status-select.tsx` (client) :
  - rendu : badge actuel (conservé) + contrôle compact « Modifier le statut » (select ou menu)
    **uniquement si** `availableTransitions(...).length > 0` ; sinon badge + `title` explicatif
    (« Séjour en cours », « Séjour non payé », « Transition réservée à l'administrateur »,
    « Réservation clôturée ») ;
  - confirmation (`confirm()` ou modale) pour `cancelled`, `no_show`, `completed` ;
  - état `pending` (spinner + `disabled`), `aria-busy`, message d'erreur `role="alert"` ;
  - appel `PUT /api/bookings/${id}` `{status}` → en succès `router.refresh()` ; en échec, **toast
    d'erreur** et la valeur affichée reste celle du serveur (pas d'optimistic optimiste trompeur).
- **Réutilisation** : extraire de `booking-row-actions.tsx` les appels réseau communs
  (`setStayStatus`, `confirmRequest`, `cancel`) vers un petit hook partagé
  (ex. `src/lib/use-booking-status.ts`) — ou les dupliquer à l'identique si l'on préfère un
  changement strictement additif ; la page détail doit continuer à se comporter exactement pareil.
- **i18n** FR + EN : `bookings.changeStatus`, `bookings.statusNoTransition`, `bookings.statusPaidRequired`,
  `bookings.statusTerminal`, `bookings.statusUpdated`, … dans `src/lib/ui-strings.ts`.

#### Lot 3 — Intégration dans `BookingsManager`

- `src/components/bulk/bookings-manager.tsx` : remplacer le contenu de la cellule statut par
  `<BookingStatusSelect … />` ; passer les props déjà sérialisées (`status`, `paymentStatus`,
  `checkOut`) + `viewerRole` (`admin` | `host`, dérivé de `isAdmin`).
- **Ne pas toucher** : colonne actions (« œil »), colonne checkbox et bulk cancel admin, filtres,
  stats — afin de garantir la non-régression du bulk.
- **Performance** : aucune requête supplémentaire (données déjà chargées) ; le calcul des
  transitions est fait côté client sur les lignes visibles.

#### Lot 4 — Audit des changements de statut (recommandé, non bloquant)

- `src/app/api/bookings/[id]/route.ts` : quand `data.status` **change** réellement, appeler
  `recordAudit({ actorId, action: AUDIT_ACTIONS.bookingStatusUpdate, entityType: "booking",
  entityId, metadata: { from, to, actor } })` (best-effort, hors transaction, sans modifier la
  réponse) ; ajouter `bookingStatusUpdate: "booking.status.update"` dans `src/lib/audit.ts`.
- **Tests d'intégration** : après une confirmation et une clôture, vérifier la présence des
  entrées `audit_log` correspondantes.

#### Lot 5 — (optionnel, hors périmètre) actions groupées de statut

- Aujourd'hui `/api/admin/bulk` ne gère que `bookings: cancel`. Étendre le contrat existant
  `{requested, succeeded, skipped[], failed[]}` à `confirm`/`complete` serait une **seconde
  tâche** (décision produit : risque de confirmations en masse irréversibles). À ne pas inclure
  dans cette itération.

#### Risques et garde-fous (Q3)

| Risque | Garde-fou |
|---|---|
| Divergence UI ↔ serveur (option proposée mais 409) | Helper unique `availableTransitions` + serveur arbitre ; garde paiement intégrée |
| Clôture sans paiement | Option `Terminée` masquée tant que `paymentStatus !== "paid"` (+ hint) |
| Action destructrice involontaire | Confirmation obligatoire pour `cancelled`/`no_show`/`completed` |
| Régression du bulk admin | Aucune modification de la checkbox, de la toolbar ni des filtres |
| Régression financière (annulation) | Réutilisation stricte de `cancelBooking` via `PUT` (refund, avantages, outbox) — pas de logique dupliquée |
| Régression e-mails/fidélité | Même route qu'aujourd'hui ; tests `route.t203/t206` rejoués |
| Doubles clics / concurrence | Bouton désactivé pendant l'appel + verrou transactionnel serveur (`FOR UPDATE`) |
| Perte de traçabilité | Lot 4 (audit) |

#### Critères d'acceptation (Q3)

1. **Hôte** : depuis la liste, une demande `pending` peut être confirmée ou annulée ; une
   réservation `confirmed` **payée** et **après le départ** peut être terminée / marquée no-show ;
   ces options sont **absentes** sinon, avec explication.
2. **Admin** : mêmes capacités depuis la liste ; les états terminaux restent des badges seuls.
3. Toute la gestion passe par `PUT /api/bookings/[id]` (aucune nouvelle route) ; les erreurs 409
   sont affichées proprement, sans changement d'état visuel.
4. Le bulk cancel admin et la page détail sont **inchangés** fonctionnellement.
5. Tests unitaires (matrice) + intégration verts ; `npm run typecheck`, `lint`, `test`,
   `i18n:check` verts ; audit présent pour chaque transition.

#### Décisions à valider avant implémentation

- **D4** : contrôle en ligne = `<select>` direct, ou badge cliquable ouvrant un menu (préférence UI) ?
- **D5** : faut-il autoriser l'admin à **rouvrir** un état terminal (`cancelled → confirmed`) ?
  Aujourd'hui la FSM l'interdit à **tout le monde** — l'ouvrir exigerait une politique explicite
  (remboursements, e-mails, fidélité) : à traiter séparément.
- **D6** : le Lot 4 (audit) est-il inclus dans la même itération ?

---

## 4. Annexe A — Protocole de non-régression (à rejouer avant/après implémentation)

```bash
# 1. Base + schéma + seed (dev)
npm run db:dev            # terminal 1 (Postgres embarqué, 127.0.0.1:55432)
npm run db:push           # terminal 2
npm run dev               # terminal 2 (les tests d'intégration visent 127.0.0.1:3000)
curl -X POST http://localhost:3000/api/seed

# 2. Garde-fous statiques
npm run typecheck
npm run lint
npm run i18n:check        # 0 candidat attendu (WARN-only par défaut)
npm run ai:check

# 3. Tests
npx vitest run src/lib/booking-lifecycle.test.ts src/lib/commission.test.ts \
                src/app/api/admin/hosts/route.test.ts
npm test                  # référence : 100 fichiers / 577 tests verts (T-211)

# 4. Build (checklist PR)
npm run build
```

**Vérifications runtime équivalentes à celles de ce rapport** (cookies admin/hôte/voyageur via
`POST /api/auth/login`) :

```bash
# Q1 — l'input de commission est-il présent pour un hôte approuvé ?
curl -s -b admin.jar http://localhost:3000/dashboard/users | grep -c 'type="number"'   # attendu : 0 aujourd'hui

# Q1 — l'API accepte-t-elle un taux sur un hôte approuvé ? (preuve du manque côté UI)
curl -s -b admin.jar -X PATCH http://localhost:3000/api/admin/hosts/<hostId> \
  -H 'content-type: application/json' -d '{"action":"approve","commissionRate":12}'    # 200 aujourd'hui

# Q2 — parcours d'avis
curl -s -b cust.jar http://localhost:3000/mes-reservations | grep -o 'Laisser un avis' | wc -l
curl -s -b cust.jar -X POST http://localhost:3000/api/reviews \
  -H 'content-type: application/json' -d '{"bookingId":"<id>","overallRating":9}'       # 201

# Q3 — la cellule statut contient-elle un contrôle ?
curl -s -b host.jar http://localhost:3000/dashboard/bookings \
  | grep -o '<select[^>]*>' | wc -l    # 3 selects au total = sélecteurs langue + devise d'affichage
                                       # et filtre statut de la barre d'outils ; AUCUN dans la colonne Statut
                                       # (vérification structurelle : la cellule rend un <span> badge, pas d'input)
```

## 5. Annexe B — État de l'environnement de vérification

- PostgreSQL embarqué 18.4 (`.data/pg`, gitignoré) initialisé et laissé en marche ; schéma appliqué
  (`drizzle-kit push`) ; `next dev` sur `0.0.0.0:3000` ; `next build` **vert** puis `next start`
  sur `:3100` pour les contrôles en rendu production.
- `tests d'intégration live` : `src/app/api/admin/hosts/route.test.ts` → **5/5 verts** quand le
  serveur répond sur `:3000` (sinon `describe.skip`, comportement normal du fichier).
- Unitaires ciblés : `booking-lifecycle` 3/3, `commission` 5/5.
- État du seed **restauré** après les vérifications (avis de test supprimé, agrégat de propriété
  recalculé, hôtes/hébergements de test supprimés) : 8 hébergements, 33 réservations, 24 avis,
  1 hôte `approved` + 1 admin.
- Aucune modification de code source n'a été introduite par cette analyse ; le seul fichier ajouté
  est le présent rapport (`next-env.d.ts`, réécrit par `next dev`, est restauré tel que committé).
