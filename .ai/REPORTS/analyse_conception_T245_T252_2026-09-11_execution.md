# Analyse de conception — T-245 → T-252 (audit n°5, exécution)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking` · **HEAD de l'analyse** : `8253c74`
- **Nature** : analyse de **conception détaillée** avant implémentation (§15.1). Aucune ligne de code
  produit modifiée à ce stade ; les choix ci-dessous engagent l'implémentation à venir.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_execution.md` (constats A1→A8).
- **Rapport d'impact associé** : `.ai/REPORTS/analyse_impact_T245_T252_2026-09-11_execution.md`.

---

## T-245 (A2) — Pagination : côté page pour le RSC, opt-in pour l'API

**Conception**

1. **Pages RSC** (aucun contrat public) : helper `src/lib/pagination.ts`
   ```ts
   export const DEFAULT_PAGE_SIZE = 25;
   export function parsePage(raw: string | undefined): number   // ≥ 1, non numérique → 1
   export function pageWindow(page: number, size = DEFAULT_PAGE_SIZE): { limit: number; offset: number }
   ```
   Chaque page ajoute `searchParams.page`, applique `.limit(size + 1).offset(offset)` (la ligne
   surnuméraire prouve l'existence de la page suivante sans `COUNT` supplémentaire) et rend
   `<Pagination page={page} hasNext={…} total={…} />` (composant serveur, liens `<Link>` préservant
   les filtres existants). Aucune logique métier déplacée.
2. **API** : params optionnels. Présence détectée par `searchParams.has("limit") || has("offset")` ;
   bornes identiques à `/api/properties` (1–100, `offset` ≥ 0, non numérique → 400 `issues`) ;
   réponse : tableau inchangé + en-tête `X-Total-Count` (calculé par un `COUNT` filtré identique).
   Sans paramètre : requête et corps **strictement** identiques à aujourd'hui.

**Alternative écartée** : tout paginer par défaut dans l'API (rupture silencieuse pour tout appelant
existant) ou introduire un objet enveloppe (rupture de forme).

**Tests** : `pagination.test.ts` (parseWindow, bornes) ; route (sans paramètre → même tableau qu'avant) ;
RSC (page 1 / page 2 / page au-delà → état vide cohérent).

---

## T-246 (A1) — Favoris : rendre le multi-listes complet sans changer la cible par défaut

**Conception**

1. `GET /api/wishlists` : `orderBy(asc(wishlists.createdAt), asc(wishlists.id))` + champ additif
   `defaultWishlistId` = premier id (déterministe). Le cœur continue d'écrire dans la **même** liste
   que le comportement actuel pour un utilisateur à une seule liste.
2. `updateWishlistSchema` : `name: z.string().trim().min(1).max(80).optional()`. Le PATCH met à jour
   `name` seulement si fourni.
3. **Sélecteur de liste** dans `use-wishlist-toggle` : le clic long (ou un bouton discret « ⋯ » sur la
   carte) ouvre un menu listant les listes (`defaultWishlistId` coché) ; l'ajout utilise l'id choisi,
   le **clic simple** garde le comportement actuel.
4. **Déplacement** : `POST` item sur la liste cible + `DELETE` item sur la liste source **dans une
   transaction**, avec vérification de propriété des deux listes ; refus si l'item existe déjà dans la
   cible (message déjà prévu : « déjà dans la liste »).

**État & accessibilité** : menu fermable (`Esc`), `aria-expanded`, focus visible ; aucune nouvelle
route publique.

---

## T-247 (A3) — Dialogue de motif réutilisable + motif obligatoire

**Conception**

1. `src/components/ui/dialog.tsx` : composant client contrôlé (`open`, `onClose`, `title`,
   `description`, `children`, `footer`), `role="dialog"`, `aria-modal`, `aria-labelledby`, focus piégé,
   retour du focus à la fermeture, `Esc` (sauf `dismissible={false}` pour les actions destructives).
   Aucune dépendance externe (le repo n'a pas de bibliothèque de dialogue).
2. `src/components/admin/reason-dialog.tsx` : champ texte obligatoire (max 500, compteur), bouton
   d'action désactivé tant que `trim()` est vide, erreur d'API affichée dans le dialogue.
3. Trois remplacements **à corps de requête identique** : `review-moderate-actions.tsx`,
   `user-suspend-actions.tsx`, `property-validate-actions.tsx`. Les `confirm()` restants sont laissés
   pour une passe ultérieure (migration progressive, un composant testé à la fois).
4. `api/reviews/[id]/moderate` : `superRefine` → `moderationReason` **requis** si `status` ∈
   `{hidden, rejected}` ; `approved`/`pending` inchangés. Le message est traduit côté UI, la route
   renvoie `issues` via `zodIssues` (déjà en place depuis T-241).
5. Trace : `audit_log.metadata.reason` devient systématique pour les refus/masquages.

**Tests** : route (400 sans motif, 200 avec), dialogue (validation, annulation, focus),
smoke/simulations : vérifier qu'aucun script ne masque un avis sans motif avant le durcissement.

---

## T-248 (A6) — Journal du wallet (migration 0023)

**Schéma (additif)**

```ts
export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  kind: varchar("kind", { length: 32 }).notNull(),      // cashback | referral_referee | referral_referrer
                                                        // | booking_refund | booking_payment | manual_adjustment
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // EUR, signé
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ userIdx: index("wallet_tx_user_created_idx").on(t.userId, t.createdAt) }));
```

**Règles**

- Ligne écrite **dans la même transaction** que la mutation de `users.walletBalance` ; `balanceAfter`
  recopié de la valeur calculée (jamais recalculé après coup).
- Idempotence : les gardes existantes (`loyaltyAwardedAt`, `referralRewardedAt`) restent la source
  d'unicité ; le journal n'ajoute pas de contrainte d'unicité fonctionnelle.
- **Aucun backfill** : le journal démarre à la migration (note dans `KNOWN_LIMITATIONS.md`).
- Lecture : 20 derniers mouvements dans `/mon-compte` (libellés i18n, montant signé, date civile via
  `src/lib/dates.ts`), plus un lien discret « d'où vient mon solde ? ».
- **Décision produit** (consommation) traitée séparément : soit `kind: booking_payment` (déduction au
  règlement sur place), soit gel explicite du programme.

---

## T-249 (A4) — `sortIgnored`

`SearchWarning` gagne `"sortIgnored"` ; `searchFilterWarnings` compare `params.sort` à la liste
blanche `["price_asc", "price_desc", "popularity", "rating"]` ; `SEARCH_WARNING_KEY` gagne
`search.warn.sortIgnored`. API inchangée (tolérance conservée). Verrou i18n **1682 → 1684**.

---

## T-250 (A7) — Supervision des crons (migration 0024)

```ts
export const cronRuns = pgTable("cron_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull(),      // price-alerts | payouts
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at"),
  ok: boolean("ok").notNull().default(false),
  durationMs: integer("duration_ms"),
  counters: jsonb("counters"),
  errorMessage: text("error_message"),
}, (t) => ({ nameIdx: index("cron_runs_name_started_idx").on(t.name, t.startedAt) }));
```

- Helper `runWithTrace(name, fn)` : mesure, écrit la ligne en succès **et** en échec (trace dans un
  `try/catch` imbriqué qui ne masque jamais l'erreur d'origine).
- Écran admin `/dashboard/cron` : dernier passage par tâche, âge, compteurs, badge rouge si
  `now - startedAt > 2 × période attendue` ; lecture seule.
- `cronRuns` est purgée par `purgeTechnicalData()` (T-243), avec compteur exposé dans la réponse cron.
- `cron/payouts` (legacy 410) **ne reçoit pas** de trace : la route est hors service par décision T-209
  — à documenter dans `KNOWN_LIMITATIONS.md` pour éviter un faux badge rouge.

---

## T-251 (A5) — Message neutre + code machine

`checkParticipant` inchangé (le cloisonnement n'est pas touché). Le handler renvoie
`{ error: t("messages.notAccessible"), code: "CONVERSATION_NOT_ACCESSIBLE" }` en 403 (message neutre
couvrant « inexistante » et « tiers »), et la page `/messages` affiche un état « conversation
indisponible » avec retour à la liste au lieu d'une erreur brute. Aucun changement de statut HTTP
(aucune fuite d'existence).

---

## T-252 (A8) — Hygiène

Suppression de `applyWalletToTotal` + `wallet-currency.test.ts` (aucun appelant applicatif — vérifié) ;
inscription de `useWalletCredits` (accepté, ignoré, décision T-207) dans la section « Surfaces
inactives » de `KNOWN_LIMITATIONS.md`.

---

## Ordre d'exécution et définition de « terminé »

**Ordre** : T-247 → T-245 → T-249 → T-252 → T-246 → T-250 → T-251 → T-248.
**Définition de terminé (par tâche)** : tests unitaires et/ou d'intégration au vert, `npm run ci`
complète verte (typecheck · lint · i18n · ai:check · vitest · build · smoke 95/95), vérification
runtime du scénario concerné, verrou i18n à jour, BACKLOG/PROGRESS/DEVLOG mis à jour, `STATE.md`
resynchronisé en fin de session (R7).
