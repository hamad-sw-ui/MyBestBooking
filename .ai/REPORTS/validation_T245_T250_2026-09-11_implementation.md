# Validation — implémentation de l'audit n°5 (T-245 → T-250)

- **Date** : 2026-09-11
- **Branche** : `arena/01a08b7d-mybestbooking`
- **Périmètre** : T-247, T-245, T-246, T-250, T-248 (étapes 1-2) — les constats A4 (T-249), A5 (T-251)
  et A8 (T-252) avaient été livrés au commit `9afae29`.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_execution.md`

## 1. Ce qui a été livré

| Tâche | Constat | Livrable | Migration |
|---|---|---|---|
| T-247 | A3 — motifs de modération en `window.prompt`, `moderationReason` optionnel | `Dialog` accessible + `ReasonDialog` (motif obligatoire, 0/500) ; 3 écrans admin migrés ; motif requis côté serveur pour `hidden`/`rejected` | — |
| T-245 | A2 — aucune pagination sur 6 écrans RSC, API de liste non bornées | fenêtre progressive (`parsePageWindow` + `<ShowMore>`, 25/500) sur 6 écrans ; pagination **opt-in** de `GET /api/bookings` et `GET /api/messages` (`X-Total-Count`) | — |
| T-246 | A1 — multi-listes à moitié câblé (ordre non déterministe, pas de renommage, pas de déplacement) | tri stable + `defaultWishlistId` ; `PATCH name` ; `POST /api/wishlists/move` transactionnel ; sélecteur et déplacement UI | — |
| T-250 | A7 — crons sans trace ni supervision | `cron_runs` + `runWithTrace` + `getCronHealth` + `/api/health` (`cronStatus`, `crons[]`) + `/dashboard/cron` + purge 90 j | **0023** |
| T-248 | A6 — wallet muté sans journal | `wallet_transactions` (append-only) écrite dans les 4 transactions de solde ; `GET /api/wallet/transactions` ; historique dans `/mon-compte` | **0024** |

## 2. Garanties de non-régression

- **Contrats d'API préservés** : `GET /api/bookings` et `GET /api/messages` sans `limit`/`offset`
  renvoient **exactement** la réponse historique (aucun changement d'enveloppe) ; la pagination n'est
  active que si les paramètres sont fournis.
- **Solde** : `users.wallet_balance` reste la source de vérité ; aucun écran ni calcul de prix ne
  change. Le journal est écrit dans la transaction du solde (échec du journal ⇒ crédit annulé).
- **Cron** : le corps de la tâche est inchangé, la réponse HTTP conserve ses compteurs, et l'écriture
  de la trace est best-effort — `runWithTrace` ne peut pas faire échouer la tâche.
- **Health** : `{ok, database}` conservés, HTTP 200 conservé ; `cronStatus`/`crons[]` sont additifs et
  `checkCronHealth` ne lève jamais (`unknown`).
- **Migrations** : 0023 et 0024 sont purement additives (`CREATE TABLE IF NOT EXISTS` +
  index), aucune colonne existante n'est touchée.

## 3. Preuves automatisées

- **Tests ciblés** : `reviews/[id]/moderate` 8/8 · `reason-dialog` 4/4 · `page-window` 11/11 ·
  `route.t246` 4/4 · `cron-trace` 5/5 · `cron/price-alerts/route.t248` 3/3 · `wallet-ledger` 5/5 ·
  `wallet-history-card` 3/3 · `ui-strings` 7/7.
- **`npm run ci`** (vitest → build → smoke) : **verte** — typecheck 0, lint 0, i18n 0 candidat,
  vitest **135 fichiers / 775 tests, 0 échec**, build production, smoke **95/95**.
- **`npm run ai:check`** : 19 OK / 1 warn / 0 fail (warn **R7** uniquement : `STATE.md` ne peut pas
  citer le SHA du commit qui le contient ; motif documenté dans le fichier).

## 4. Preuves runtime (serveur de développement, base seedée)

| Sonde | Résultat |
|---|---|
| `/dashboard/bookings` (admin) | 200 — « 25 résultats affichés sur 30 », « Afficher 25 de plus », lien `?limit=50`, « Tout afficher (30) » |
| `/dashboard/bookings?limit=50` | 200 — 30/30, aucun bandeau |
| `/dashboard/bookings?limit=999999` | 200 — bandeau de plafond (500) |
| `GET /api/bookings` (sans paramètre) | 200 — 30 lignes, **aucun** `X-Total-Count` (contrat historique) |
| `GET /api/bookings?limit=5` | 200 — 5 lignes + `X-Total-Count: 30` |
| `GET /api/bookings?limit=0\|-3\|abc\|1.5`, `offset=-1` | 400 avec message explicite (5/5) |
| `POST /api/wishlists/move` (couvert par tests) | déplacement transactionnel, 404/400 sur cas invalides |
| `PATCH /api/wishlists {name}` | 200 + `name` mis à jour, `shareToken` inchangé |
| `GET /api/health` (avant cron) | 200 `{ok:true, cronStatus:"missing"}` |
| `GET /api/cron/price-alerts` | 200 — 18 clés, compteurs identiques à l'existant |
| `GET /api/health` (après cron) | 200 `cronStatus:"ok"`, `durationMs`, compteurs, `checkedAt` |
| `/dashboard/cron` (admin) | 200 — `data-status="ok"`, titre et libellés FR |
| `/dashboard/cron` (customer) | 307 → `/` (garde admin conservée) |
| `GET /api/wallet/transactions` | 200 `{transactions, total, balance}` · 401 sans session · 400 `limit=0` |

## 5. État de la base après validation

Résidus de smoke et de tests purgés ; retour à l'état seed :
`users` **8** · `properties` **8** · `bookings` **30** · `reviews` **21** ·
`price_alerts` **0** · `wishlist_items` **0** · `cron_runs` **0** · `wallet_transactions` **0** ·
comptes `@test.local` supprimés (5) · 30 e-mails résiduels supprimés.

## 6. Décision produit T-248 §3 — tranchée le 2026-09-11

**Le wallet BestRewards est gelé (gel explicite assumé).** Le solde reste un **crédit futur** tracé
(journal `wallet_transactions` + historique `/mon-compte`) ; aucun code de déduction n'est ajouté, ni
dans le tunnel ni au règlement sur place. Les libellés FR et EN qui parlent du solde annoncent
désormais le gel (14 valeurs révisées : `account.availableBalance`, `account.walletHint`,
`search.walletBanner`, `reservation.walletReductionNote`, `bestrewards.benefitCashback`,
`bestrewards.how3Desc`, `bestrewards.faq4A` — verrou i18n inchangé, **1739**, aucune clé ajoutée).
La décision est inscrite dans `.ai/KNOWN_LIMITATIONS.md` et verrouillée par
`src/lib/wallet-policy.test.ts` (3 tests) : le test échoue si les libellés cessent d'annoncer le gel
ou si `applyWalletToTotal` / une déduction réapparaît. Ouvrir la consommation (avoir au règlement sur
place, ligne de journal `kind: "booking_payment"`) devient donc un **choix produit explicite**.

**Aucune ligne de l'audit n°5 n'est ouverte.**
