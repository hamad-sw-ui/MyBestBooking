# Analyse runtime n°5 — scénarios et éléments fonctionnels inachevés ou mal pensés

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking` · **HEAD analysé** : `8253c74`
- **Périmètre** : application en exécution (dev `:3000`, PostgreSQL `:55432`, base de démonstration seedée
  8 users / 8 hébergements / 35 réservations / 26 avis) — visititeur, voyageur (`customer@`), hôte (`host@`), admin (`admin@`).
- **Nature** : **analyse seule — aucune ligne de code produit modifiée par cette passe.** Les sondes ont
  créé puis supprimé leurs propres données ; l'état de base est revenu à la référence (voir §5).
- **Suites** : items **T-245 → T-252** ajoutés à `.ai/BACKLOG.md`.
- **Rapport d'origine** : `docs/analyse_2026-09-11_audit_runtime_execution.md` (copie `.ai/REPORTS/analyse_runtime_n5_2026-09-11_execution.md`).

---

## 1. Objet et méthode

Les analyses n°1 à n°4 (T-217 puis T-221→T-231, T-232→T-241, T-242→T-244) ont successivement couvert :
les promesses d'interface non tenues, les parcours à moitié branchés, les scénarios de bout en bout,
puis le cloisonnement multi-tenant et la rétention des données. Cette cinquième passe **rejoue les
scénarios métier à l'exécution** (codes promo, stop-sell, avis, heure d'arrivée, disponibilité, favoris,
alertes prix, messagerie) et **attaque les surfaces jamais interrogées** : volumétrie des écrans de liste,
cycle de vie complet d'une liste de favoris, saisie des motifs de modération, traçabilité des mouvements
du wallet, supervision des tâches planifiées.

| Moyen | Détail |
|---|---|
| Matrice de rôles | `/tmp/a4-pages.sh` : routes réelles des 3 rôles (hôte → 307 sur les écrans admin, voyageur → 307 sur `/dashboard/*`, 404 pour les routes inventées) |
| Sonde d'endpoints | `/tmp/a4-probe.sh` + jars `/tmp/a4/{customer,host,admin}.jar` : statuts et messages des routes sensibles (facture, promos, crons, recherche, devis, messages, audit, settings) |
| Sonde de flux | `/tmp/a4-flows.mjs` : wishlists (jeton de partage, rotation), alertes prix, messagerie cloisonnée, votes d'avis, suspension |
| Scénarios métier | `/tmp/a4-scenarios.mjs` + `/tmp/a4-scen2.mjs` + `/tmp/a4-scen3.mjs` : codes promo (4 cas), stop-sell bout en bout (recherche API + page + fiche + devis + réservation), réponse d'hôte (publication + tiers), heure d'arrivée dans les e-mails, suppression d'alerte de prix, disponibilité de chambre par l'hôte |
| Analyse statique croisée | **66 endpoints appelés depuis l'UI** confrontés aux `route.ts` existants (0 manquant) · recherche `TODO/FIXME/XXX/HACK` (0 dans `src/`) · `href="#"` (0) · `window.prompt` (3) · `dangerouslySetInnerHTML` (4, légitimes) |
| Vérification base | après chaque sonde : `bookings`, `email_outbox`, `review_votes`, `price_alerts`, `room_availability`, `wishlists`, `review_votes` — **état final identique au seed** |

---

## 2. Synthèse des constats

| # | Constat | Type | Sévérité | Vérifié |
|---|---|---|---|---|
| **A1** | Listes de favoris : la fonctionnalité multi-listes est **à moitié câblée** (création/partage/suppression OK ; pas de renommage, pas de choix de liste, pas de déplacement d'un favori, ordre de liste non déterministe côté API) | Inachevé | Moyenne | runtime + code |
| **A2** | **Aucune pagination** sur les écrans de liste (`dashboard/bookings`, `users`, `reviews`, `properties`, `promotions`, `mes-reservations`, onglet messages) ; `GET /api/bookings` et `GET /api/messages` renvoient **toutes** les lignes, alors que `GET /api/reviews` et `GET /api/properties` sont paginés | Inachevé | Moyenne | runtime + code |
| **A3** | Motifs de modération saisis par `window.prompt` natif (3 écrans admin) : non validés, non localisables, non accessibles ; `moderationReason` est **optionnel** côté API → un avis masqué/refusé peut l'être **sans motif** (audit et e-mail à l'auteur sans raison) | Mal pensé | Moyenne | code + API |
| **A4** | Recherche : un `sort` inconnu est **silencieusement** remplacé par le tri `rating` (200), alors que les 4 autres filtres ignorés déclenchent un bandeau explicatif (T-175) — trou de cohérence | Mal pensé | Faible | runtime + code |
| **A5** | Messagerie : « conversation inexistante » et « conversation d'un tiers » renvoient **le même 403** « Accès refusé » — cloisonnement correct, mais lien périmé indistinguable d'un refus (support/diagnostic) | Mal pensé | Faible | runtime + code |
| **A6** | **Wallet sans journal** (reprise explicite de l'observation **O1** déjà au BACKLOG) : 4 points d'écriture mutent `users.walletBalance` sans trace ; depuis T-207 le solde ne peut plus être dépensé, donc le programme BestRewards **crédite un avoir non consommable** — décision produit jamais tranchée | Inachevé / décision | Moyenne | code + base |
| **A7** | **Aucune supervision des tâches planifiées** : `GET /api/cron/price-alerts` exécute 14 opérations (rappels, avis, clôtures, expirations, alertes prix, purge technique) sans écrire de trace d'exécution ; `/api/health` ne teste que la base → un cron muet (rappels et alertes non envoyés) est invisible | Inachevé | Moyenne | code |
| **A8** | Hygiène T-207 : `applyWalletToTotal()` (`src/lib/wallet-currency.ts`) n'a **plus aucun appelant applicatif** (seul son test l'exerce) et `useWalletCredits` est accepté puis ignoré sans être documenté dans `KNOWN_LIMITATIONS.md` | Hygiène | Faible | code |

---

## 3. Constats détaillés et solutions non régressives

### A1 — Favoris : le multi-listes s'arrête au milieu du chemin

**Ce qui fonctionne (vérifié)** : création de listes nommées (`create-wishlist-button.tsx`), ajout/retrait
d'un favori par le cœur avec **auto-création** de « Mes favoris » si l'utilisateur n'en a pas
(`use-wishlist-toggle.ts:138`), partage public avec rotation de jeton et confirmation de portée
(T-238), suppression d'une liste (`DELETE /api/wishlists?wishlistId=`, 200 en runtime), page publique
`/wishlists/share/[token]` noindex. Le flux complet a été rejoué : ajout → partage → rotation (ancien
jeton 404, nouveau 200) → suppression.

**Le problème** :

1. `GET /api/wishlists` **ne trie pas** les listes (0 `orderBy`) ; or le cœur écrit dans
   `data.wishlists[0]` (`use-wishlist-toggle.ts:138`) et le repli d'affichage utilise la même
   première entrée (`:111`). La page `/mes-favoris` affiche, elle, les listes par `createdAt desc`.
   Conséquence : avec ≥ 2 listes, **le favori peut être déposé dans une liste qui n'est pas celle
   affichée en premier**, et l'utilisateur ne peut pas choisir sa destination.
2. `updateWishlistSchema` est `.strict()` et n'accepte que `wishlistId`/`isPublic`/`rotateShareToken`
   (`api/wishlists/route.ts:23-27`) : **renommer une liste est impossible**, aucune UI ne le propose.
3. Aucune action ne permet de **retirer un favori d'une liste donnée depuis `/mes-favoris`** ni de le
   **déplacer** vers une autre liste (le retrait n'existe que sur les cartes, cœur de la fiche).

**Solution non régressive (T-246)** — quatre étapes, chacune indépendante et additive :

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Trier `GET /api/wishlists` par `createdAt asc, id` **et** exposer `defaultWishlistId` (première liste) | Ajout d'un champ ; l'ordre devient *déterministe* sans changer le contrat ; utilisateur à 1 liste : aucun changement visible |
| 2 | `updateWishlistSchema` accepte `name` **optionnel** (1–80 car., trim) + UI de renommage en ligne sur `/mes-favoris` | Champ optionnel : les appels actuels (partage/rotation) inchangés ; 2 clés i18n FR/EN |
| 3 | Sélecteur de liste dans le cœur (`menhir`) : choix explicite, **défaut = comportement actuel** (liste historique) | Sans interaction, le code suit le chemin existant |
| 4 | Action « déplacer » (POST item + DELETE item dans une transaction) — ou endpoint `PATCH /api/wishlists/[id]/items` | Nouveau chemin seulement ; contrainte d'unicité déjà gérée (400 « déjà dans la liste ») |

**Garde-fous** : tests unitaires du schéma PATCH (`name` vide → 400, `name` absent → 200 inchangé),
test d'ordre stable de `GET`, test de transaction du déplacement (aucun item perdu), verrou i18n mis à
jour, vérification runtime avec 2 listes dont la plus récente contient un favori.

---

### A2 — Volumétrie : les écrans de liste chargent tout, et deux API ne sont pas paginées

**Ce qui fonctionne** : `GET /api/properties` borne `limit` (1–100, défaut 20), refuse `offset` négatif
et applique la pagination **après** tous les filtres (T-121) — vérifié : `?limit=1000` → `limit=100` ;
`GET /api/reviews` applique `limit`/`offset` ; `GET /api/admin/audit` borne `limit` à 200.

**Le problème** : les autres listes chargent **toutes les lignes** :

| Surface | Preuve | Impact à l'échelle |
|---|---|---|
| `dashboard/bookings`, `users`, `reviews`, `properties`, `promotions`, `mes-reservations` | pages RSC sans `.limit()` (grep : 0 occurrence) ; les écrans trient puis rendent la totalité | temps de réponse et mémoire linéaires ; tableaux difficilement navigables |
| `GET /api/bookings` | `orderBy(createdAt desc)` sans `limit`/`offset` | un admin récupère **toutes** les réservations de la plateforme |
| `GET /api/messages` | liste des conversations sans borne | idem côté messagerie |
| `/dashboard/audit` | `audit-filter.tsx:27` documente lui-même « pas de pagination API » ; l'écran charge les N dernières lignes d'un coup | socle de support inexploitable au-delà de quelques centaines de traces |

Aujourd'hui la base de démonstration (8 users / 35 réservations / 26 avis) masque totalement le coût :
c'est un **mur de charge**, pas un bug visible.

**Solution non régressive (T-245)** — deux pistes selon la surface :

1. **Pages RSC (aucun contrat public)** : ajout d'une pagination serveur *côté page* uniquement —
   `?page=N` (défaut 1) + `PAGE_SIZE` (25 par exemple), `.limit(PAGE_SIZE + 1).offset(...)` pour savoir
   s'il existe une page suivante, et un composant `Pagination` partagé (précédent/suivant + « page X sur Y »).
   Les tris et filtres existants sont conservés ; sans `?page`, la page 1 s'affiche exactement comme
   aujourd'hui **moins les lignes au-delà de 25** → à accompagner d'un compteur « X résultats » pour
   rester explicite.
2. **API** : pagination **opt-in** — `limit`/`offset` n'agissent que si l'un des deux paramètres est
   présent ; la réponse gagne alors un en-tête `X-Total-Count` **sans changer la forme du corps**
   (les appelants actuels reçoivent toujours un tableau). Les bornes reprennent celles de
   `/api/properties` (`limit ≤ 100`, `offset ≥ 0`, valeurs non numériques → 400).

**Garde-fous** : tests de contrat « sans paramètre, réponse identique à aujourd'hui » (clé de non-régression),
tests de bornes (`limit=0`, `limit=-1`, `offset=-1` → 400 ; `limit=1000` → 100), test RSC de page 2,
vérification runtime avec `total` > taille de page.

---

### A3 — Motifs de modération : `window.prompt` natif et motif facultatif

**Ce qui fonctionne** : la modération des avis est transactionnelle (statut + recalcul d'agrégat), elle
envoie un e-mail à l'auteur (T-225) et écrit une trace `review.moderate` dans `audit_log`.

**Le problème** :

1. Trois écrans admin réclament un motif via `window.prompt`
   (`admin/review-moderate-actions.tsx:40`, `admin/user-suspend-actions.tsx:63`,
   `property-validate-actions.tsx:25`). Le dialogue natif : pas de mise en forme, pas de compteur,
   impossible à tester, bloqué par certains environnements (mode standalone, iframes restreintes),
   fermeture accidentelle = action annulée sans message, et aucun contrôle de contenu (espaces, 4000
   caractères). Le composant `ui/` ne contient ni `dialog.tsx` ni `modal.tsx` : **il n'existe aucun
   dialogue réutilisable**.
2. `PATCH /api/reviews/[id]/moderate` accepte `moderationReason` **optionnel**
   (`api/reviews/[id]/moderate/route.ts:16`) : un avis `hidden`/`rejected` peut être enregistré **sans
   motif**. L'e-mail d'information part alors sans explication et `audit_log` ne porte pas de `reason`
   (le champ n'est ajouté que si présent, `:91`) → le support ne peut pas répondre à « pourquoi mon avis
   a été retiré ? ».

**Solution non régressive (T-247)** :

1. Créer `src/components/ui/dialog.tsx` (ou `reason-dialog.tsx`) : `role="dialog"`, `aria-modal`,
   `aria-labelledby`, focus piégé + retour du focus, fermeture `Esc`/clic extérieur, bouton de
   validation désactivé tant que le motif est vide, compteur de caractères (max 500 comme l'API).
2. Remplacer les 3 `window.prompt` **sans changer les appels réseau** (mêmes `fetch`, mêmes corps
   quand un motif est fourni) — les 7 `confirm()` destructifs restent hors périmètre (décision :
   migration progressive, un seul composant à tester à la fois).
3. Rendre `moderationReason` **obligatoire pour `hidden`/`rejected`** dans le schéma zod
   (`superRefine`) → 400 explicite via `zodIssues` déjà en place. `approved`/`pending` restent
   acceptés sans motif (comportement inchangé).

**Garde-fous** : tests de la route (motif manquant + statut `rejected` → 400, statut `approved` sans
motif → 200), test du dialogue (validation, annulation, focus), e2e runtime admin : masquer un avis avec
motif → `audit_log.metadata.reason` présent, e-mail envoyé.

---

### A4 — Recherche : le tri inconnu est le seul filtre ignoré en silence

**Ce qui fonctionne** : T-175 signale déjà 4 cas (`datesIgnored`, `pastDates`, `priceInverted`,
`guestsIgnored`) via `src/lib/search-warnings.ts` et un bandeau sur `/recherche`.

**Le problème** : `GET /api/properties?sort=nimportequoi` répond **200** avec le tri par défaut
(`switch (sort)` → `default` = `rating`, `api/properties/route.ts:216`) et **aucun avertissement** ne
l'accompagne : c'est le dernier filtre « avalé » sans le dire. Le cas se produit en pratique dès qu'une
URL de recherche est partagée/retapée (les valeurs valides ne sont pas rappelées à l'utilisateur).

**Solution non régressive (T-249)** : ajouter `sortIgnored` au type `SearchWarning` et sa clé
(`search.warn.sortIgnored`) consommée par le bandeau existant, sans toucher au comportement de l'API
(tolérance conservée). Verrou i18n : **1682 → 1683** (1 clé FR + 1 clé EN — le verrou compte les clés FR). Tests : `search-warnings.test.ts`
(cas inconnu → `["sortIgnored"]`, cas valide → `[]`), vérification runtime du bandeau.

---

### A5 — Messagerie : « introuvable » et « interdit » partagent le même 403

**Ce qui fonctionne** : le cloisonnement est étanche (anonyme 401, admin 200, pièces jointes d'autrui
404, fil d'un tiers inaccessible) et le badge de non-lus est alimenté par `unreadByUser`/`unreadByHost`.

**Le problème** : `checkParticipant()` renvoie `null` **dans les deux cas** — conversation inexistante,
ou conversation existante dont l'appelant n'est pas participant — et `GET /api/messages` répond
`403 Accès refusé` (prouvé : UUID inexistant → 403). Le choix « ne rien divulguer sur l'existence » est
défendable, mais il rend un **lien périmé** (fil supprimé, marque-page, e-mail ancien) indiscernable
d'une **interdiction**, pour l'utilisateur comme pour le support.

**Solution non régressive (T-251, XS)** : conserver le 403 pour les tiers (aucune fuite), mais renvoyer
un message neutre qui couvre les deux cas — « Conversation introuvable ou non accessible » — et un code
machine additif `code: "CONVERSATION_NOT_ACCESSIBLE"` dans le corps JSON (les appelants qui lisent
`error` ne changent pas). Option : dans `/messages`, une page « conversation indisponible » avec un lien
de retour plutôt qu'un écran d'erreur brut.

---

### A6 — Wallet : un avoir crédité, jamais journalisé, jamais consommé (reprise de O1)

**Ce qui fonctionne** : le calcul du cashback est correct et idempotent (`loyaltyAwardedAt`), la devise
est convertie en EUR (T-153/T-154b), les remboursements de wallet legacy sont transactionnels
(`booking-request-expiration.ts`, `booking-benefits.ts`, cron), et l'interface **dit la vérité** :
`reservation.walletReductionNote`, `search.walletBanner` et `account.walletHint` précisent que le solde
est indicatif et n'est pas déduit tant que le paiement en ligne est désactivé (T-207).

**Le problème** : le solde est une **colonne scalaire** (`users.wallet_balance`) mutée par 4 familles de
code (cashback à la clôture manuelle, cron : cashback + bonus de parrainage + remboursements, lib
`booking-benefits`, lib `booking-request-expiration`) **sans journal** : on ne peut ni expliquer un solde
à un utilisateur, ni détecter un doublon de crédit, ni auditer le programme. Et comme
`useWalletCredits` est ignoré (`api/bookings/route.ts:419`, `walletUsedEur = 0`), tout crédit BestRewards
est **définitif et non dépensable** : le programme promet un avantage qui ne peut jamais servir. Le
BACKLOG portait déjà l'observation **O1** (« consommation ou gel explicite ») ; cette passe apporte la
mesure du problème (aucune ligne de journal, 21 mutations de solde dans `src/`) et la recommande en tâche.

**Solution non régressive (T-248, reprise de O1)** — par ordre d'importance :

1. **Journal append-only `wallet_transactions`** (`id`, `user_id`, `amount` en EUR, `kind`
   ∈ {`cashback`, `referral_referee`, `referral_referrer`, `booking_refund`, `manual_adjustment`},
   `booking_id` nullable, `balance_after`, `created_at`, `actor_id` nullable) écrit **dans les
   transactions existantes** ; `users.wallet_balance` reste la source de vérité (aucun écran ne change
   de logique). Migration `0023`, `.strict()` désactivé en lecture (table interne).
2. **Historique dans `/mon-compte`** : liste des 20 derniers mouvements (date, libellé i18n, montant,
   solde après) — informatif, aucune écriture.
3. **Décision produit sur la consommation** : soit un « avoir au règlement sur place » (l'hôte constate
   le paiement `markPaidOffline` et peut déduire un montant de wallet, dans une transaction, avec ligne
   de journal `kind: "booking_payment"`) ; soit un **gel assumé** (retirer le cashback de la page
   BestRewards ou l'afficher explicitement comme « crédit futur »). Tant que la décision n'est pas
   prise, l'étape 1 est utile seule (traçabilité) et strictement additive.

**Garde-fous** : test « un crédit de cashback → 1 ligne, somme des lignes = solde », test d'idempotence
(rejeu du cron → toujours 1 ligne), test de non-régression des soldes après clôture manuelle et après
expiration.

---

### A7 — Tâches planifiées sans trace d'exécution

**Ce qui fonctionne** : les traitements sont idempotents (gardes `loyaltyAwardedAt`, `eventKey` d'e-mails,
purges bornées à 100/run) et la réponse du cron expose **14 compteurs**
(`completedBookings`, `bookingRemindersSent`, `reviewRequestsSent`, `expiredPendingBookings`,
`technicalPurge`, …) ; `/api/health` teste PostgreSQL.

**Le problème** : rien ne **conserve** ces compteurs. Ni `audit_log` (0 `recordAudit` dans le cron), ni
table dédiée : si l'appelant externe (cron système) cesse d'appeler `/api/cron/price-alerts` — clé absente,
URL changée, conteneur en panne — les rappels J-3/J-1, les demandes d'avis, les alertes prix et les
expirations **s'arrêtent en silence**. Certaines conséquences sont atténuées par les mécanismes
paresseux (T-234 : expiration recalculée à la lecture), pas les e-mails ni les alertes prix.

**Solution non régressive (T-250)** : table `cron_runs` (`name`, `started_at`, `finished_at`, `ok`,
`duration_ms`, `counters` JSONB, `error_message`, `created_at`) écrite **en fin d'exécution** de chaque
tâche (y compris en échec, dans le `catch`), + écran admin « Tâches planifiées » (dernier passage, âge,
compteurs, badge rouge au-delà de 2× la période attendue) alimenté par une lecture triviale. La table est
purgée par `purgeTechnicalData()` (T-243) au même titre que `sessions`/`email_outbox`. Aucune route
existante ne change de contrat (l'écriture est un effet de bord du cron).

**Garde-fous** : test « run en succès → 1 ligne `ok=true` avec compteurs », test « exception → ligne
`ok=false` avec message », test de purge, vérification runtime : appeler le cron en dev (bypass
`NODE_ENV !== "production"` conservé) et lire l'écran.

---

### A8 — Hygiène : résidus de T-207

`applyWalletToTotal()` (`src/lib/wallet-currency.ts:28`) n'est plus appelée par aucun code applicatif —
seul `wallet-currency.test.ts` l'exerce (8 tests). Le champ `useWalletCredits` du POST réservation est
accepté puis volontairement ignoré (`walletUsedEur = 0`, commentaire T-207 en place) mais n'est pas
recensé dans `KNOWN_LIMITATIONS.md` (§ « Surfaces inactives »).

**Solution non régressive (T-252, XS)** : soit supprimer la fonction **et** son test (aucun appelant →
aucun comportement perdu), soit l'annoter `@deprecated` et l'ajouter à la liste des surfaces inactives ;
dans les deux cas, ajouter `useWalletCredits` à `KNOWN_LIMITATIONS.md` avec la décision T-207. Choix
recommandé : suppression + note de documentation (le test de la fonction disparaît avec elle).

---

## 4. Vérifications saines (hypothèses infirmées — à ne pas rouvrir)

Ces pistes avaient été listées comme suspects en début de passe ; les sondes les ont **invalidées**. Elles
sont consignées ici pour éviter qu'une future analyse les rejoue.

| Hypothèse initiale | Résultat |
|---|---|
| `DELETE /api/price-alerts/[id]` (utilisé par `/mes-favoris`) serait cassé (405 observé sur la collection) | **Faux** : `POST` 201 (upsert voulu, `onConflictDoUpdate`), `DELETE /[id]` **200**, alerte inexistante 404, id invalide 400 ; le 405 ne portait que sur la **collection** (méthodes non exposées = normal) |
| `PUT /api/rooms/[id]/availability` renverrait 400 sur une chambre légitime | **Faux** : le corps attend un lot `{ days: [{ date, availableCount, stopSell, minStay }] }` ; testé par l'hôte propriétaire → 200, `stop_sell=true` persisté, annulation 200 |
| `/api/auth/verify` serait une route morte (aucun `fetch` appelant) | **Faux** : elle est le **lien cliquable** construit dans les e-mails par `register` et `resend-verification` (`${base}/api/auth/verify?token=…`) — elle n'apparaît donc pas dans les `fetch()` |
| Stop-sell décoratif (déjà corrigé T-244 pour le stock, à confirmer sur la recherche) | **Confirmé sain** : dates bloquées → recherche API 8 → **7** résultats, page `/recherche` ne mentionne plus la fiche, fiche affiche « indisponible », devis et réservation → **409** « Cette chambre n'est plus disponible pour ces dates » |
| Réponse de l'hôte à un avis inopérante | **Faux** : `POST /api/reviews/[id]/reply` (corps `{ reply }`) → 200, réponse **visible** sur la fiche publique, tiers → 403, 2ᵉ réponse → écrasement géré (le 400 initial venait du nom de champ de la sonde) |
| Heure d'arrivée perdue (T-236) | **Confirmé sain** : réservation créée avec `18:45` → **les 2 e-mails** (`customer@`, `host@`) contiennent l'heure |
| Codes promo | **Confirmé sain** : valide 200 (−50), minuscule 200 (−50), sous minimum 400 (« Réservation minimum 50.00 »), inconnu 404 (« Code inconnu ») |
| Pagination de la recherche non bornée | **Faux** : `?limit=1000` → `limit=100` (clamp 1–100), `offset` négatif → 400 |
| Boutons morts / fonctionnalités fantômes | **Aucun** : 66 endpoints appelés par l'UI, tous présents ; 0 `TODO/FIXME` ; 0 `href="#"` ; les 3 `window.prompt` sont fonctionnels (A3 traite leur qualité) |
| Rétention des données techniques | **Déjà livrée** (T-243) : `purgeTechnicalData()` purge sessions expirées > 7 j et `email_outbox` > 90 j, compteurs exposés par le cron |
| Export analytique manquant (O6) | **Déjà livré** (T-241) : sélecteur de période + `GET /api/dashboard/analytics/export` |
| Wallet utilisable dans le tunnel | **Non, assumé** : T-207 a désactivé la dépense (voir A6) et l'interface l'explique sur 3 écrans |

---

## 5. État de la base après la passe

Toutes les écritures des sondes ont été annulées ou purgées, puis contrôlées en SQL :

| Contrôle | Valeur finale |
|---|---|
| `bookings` | 35 (seed) — réservations de sonde `MBB-2026-MBF4YG` / `MBB-2026-2U57ZT` supprimées, e-mails associés purgés |
| `email_outbox` | 1 ligne (antérieure aux sondes) |
| `review_votes` | **0** (vote de sonde supprimé) |
| `reviews.host_reply` | **0** (réponse de sonde retirée après vérification publique) |
| `price_alerts` | **0** |
| `room_availability` (`stop_sell=true`) | **0** (dates des sondes supprimées) |
| `wishlists` | 1 (seed) — aucune liste de sonde restante |
| `conversations` | 0 |

---

## 6. Correspondance constat → tâche

| Constat | Tâche BACKLOG | Niveau | Priorité |
|---|---|---|---|
| A2 — pagination des listes | **T-245** | M | P2 |
| A1 — favoris multi-listes | **T-246** | M | P2 |
| A3 — dialogue de motif + motif obligatoire | **T-247** | S | P2 |
| A6 — journal du wallet (O1) | **T-248** | M | P2 |
| A4 — bandeau « tri ignoré » | **T-249** | S | P3 |
| A7 — supervision des crons | **T-250** | S | P3 |
| A5 — message « conversation non accessible » | **T-251** | XS | P3 |
| A8 — hygiène T-207 | **T-252** | XS | P3 |

**Ordre recommandé** : T-247 puis T-245 (dette d'interface et de charge, sans effet de bord), T-249 +
T-252 (correctifs courts, bonne couverture de tests), T-246 puis T-250 (fonctionnalités), T-248 en
dernier (décision produit sur la consommation du wallet à trancher avant d'écrire le schéma).

---

## 7. Conclusion

Le socle métier est solide : les scénarios critiques rejoués cette fois (promos, stop-sell, avis, heure
d'arrivée, disponibilité, alertes prix, favoris, messagerie) **fonctionnent de bout en bout**, sans
régression apparente, et les défauts trouvés sont des **fins de parcours** : un multi-listes qui ne va pas
jusqu'au choix de la liste, des tableaux de bord sans pagination, des motifs de modération saisis dans des
boîtes natives et facultatifs côté API, un tri ignoré en silence, un wallet crédité sans journal ni
débouché, des tâches planifiées invisibles. Chacun des huit constats a une solution **additive** —
nouveaux paramètres optionnels, nouvelles tables, nouveaux composants, messages neutres — conçue pour
laisser inchangés les appels, les formes de réponse et les écrans qui fonctionnent aujourd'hui.
