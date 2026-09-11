# Validation — audit n°7, lot C (C5 → T-269, C6 → T-270)

- **Date** : 2026-09-11 · **Branche** : `arena/01a0913d-mybestbooking`
- **Périmètre** : constats **C5** (la « date de confirmation » de la timeline dashboard
  dérivait de `updated_at` : après un `markPaidOffline`, la date affichée glissait vers la
  date du dernier update) et **C6** (la boîte de réception `/messages` faisait une
  **requête par fil** pour le dernier message — 1 + N — sans aucun bornage du chargement)
  de l'audit n°7.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_n7_fins_de_parcours.md` § 3 (C5, C6)
- **Analyse d'impact** : `analyse_impact_T265_T270_2026-09-11_audit7.md` (antérieure au code, §14)

## 1. Livré

| Tâche | Constat | Livrable |
|---|---|---|
| **T-269** | C5 — la timeline de `/dashboard/bookings/[id]` affichait l'étape « Réservation confirmée » avec `updated_at` : un `markPaidOffline` (ou toute mutation) **faisait glisser la date de confirmation affichée** vers la date du dernier update | (a) migration additive `drizzle/0026_bookings_confirmed_at.sql` : `bookings.confirmed_at` (timestamp, **nullable**) ; (b) `PUT /api/bookings/[id]` pose `confirmed_at = now()` **dans la transaction de confirmation** (branche `status === "confirmed"`, à côté de `confirmed_by`) ; (c) la timeline de la fiche dashboard lit `booking.confirmedAt ?? booking.updatedAt ?? booking.createdAt` : les lignes historiques (`NULL`) replient sur l'ancien affichage, **inchangé** |
| **T-270** | C6 — `getConversations` de `/messages` : une requête **par fil** pour le dernier message (1 + N), aucun bornage du chargement (tous les fils de l'utilisateur chargés au premier rendu) | (a) le dernier message des fils de la fenêtre est chargé en **UNE requête** `IN (…)` (le tri `createdAt desc` donne le plus récent par fil) ; (b) **fenêtre de chargement** contrat T-245 : 25 fils par défaut, « Afficher 25 de plus », « Tout afficher (N) », plafond 500 (`parsePageWindow` + `<ShowMore>`, 9ᵉ écran rattrapé) ; (c) la **visibilité** (fil avec message OU fil vide de < 7 jours — règle pure T-217/P7) et la **recherche** (nom/ville du bien ou contenu du dernier message) passent en **SQL partagé** entre la liste et le compteur du bandeau : le « N sur M » ne peut pas mentir (contrat T-257). Le garde-fou JS (`isConversationVisible` + filtre recherche) est conservé tel quel |

**Hygiène des purges de test (signalé en cours de route)** : le `afterAll` des tests
`route.t265`/`route.t269` ne purgeait l'outbox que sur le préfixe de la **première**
réservation (`LIKE '%<8 premiers caractères>%'`) ; les e-mails des réservations suivantes
fuyaient (4 lignes observées après une passe). La purge filtre désormais sur les **IDs
complets** de toutes les réservations créées (aucun filtre SQL préfixe) — vérifié :
**0** ligne `email_outbox` résiduelle après exécution des deux fichiers (8/8).

**Correctif de robustesse test (hors périmètre, signalé en cours de route)** :
`src/app/dashboard/list-window.t257.test.ts` codait en dur « 23 chambres seed de l'hôte » —
le seed est **aléatoire** (2–4 chambres par bien, `Math.random` dans
`src/app/api/seed/route.ts`) : un simple re-seed cassait le test (constaté au passage,
24 chambres sur la base du moment). Le test compte désormais les chambres existantes de
l'hôte avant d'ajouter ses 3 fixtures, et vérifie la précondition `total > 25`. Zéro
changement de code produit.

## 2. i18n

Aucune clé ajoutée : T-269 réutilise les libellés existants de la timeline (aucun nouveau
texte), T-270 réutilise les clés `list.window.*` du contrat T-245 (déjà présentes FR/EN).
Verrou `ui-strings` inchangé (**1770**), passé dans la chaîne CI.

## 3. Preuves automatisées

- `src/app/api/bookings/[id]/route.t269.test.ts` — **4/4** (base réelle, route réelle) :
  1. la confirmation pose `confirmed_at ≈ maintenant` (+ `confirmed_by` = hôte) ;
  2. un update postérieur (`markPaidOffline`, `updated_at` avancé de > 2 s) ne fait **pas**
     bouger `confirmed_at` ;
  3. la timeline rendue (RSC) porte la date de confirmation — le dernier update est fixé
     **au jour suivant** en base, et l'étape « Demande confirmée » affiche le jour de la
     confirmation **sans** le jour du dernier update (format `formatDate` identique au
     rendu) ;
  4. ligne historique `confirmed_at NULL` + `updated_at` à J+2 → la timeline affiche la
     date de `updated_at` (repli = affichage d'avant T-269, inchangé).
- `src/app/(main)/messages/page.t270.test.ts` — **4/4** (base réelle, rendu RSC,
  compteur de requêtes SQL sur le pool) :
  1. 30 fils → **25 affichés**, bandeau « 25 résultats affichés sur 30 », liens
     `limit=50` et « Tout afficher (30) » ;
  2. `?limit=100` → les 30 fils rendus, bandeau retiré, aucune ligne perdue ;
  3. pendant un rendu complet, **0** requête de forme N+1
     (`… from "messages" where "messages"."conversation_id" = $N`) et **1** requête IN-liste
     porte les derniers messages de la fenêtre ;
  4. 5 fils vides de 30 jours ajoutés → total du bandeau **30** (pas 35) : la même
     condition de visibilité s'applique à la liste et au compteur.
- Non-régression ciblée : `list-window.t257` (rooms + conversations, 3/3),
  `conversation-visibility` (7/7), tests `(main)/messages` + `dashboard/messages` →
  **14/14** au vert ensemble.
- **Chaîne CI complète** (`npm run ci`, ordre vitest → smoke imposé) :
  typecheck 0 · lint 0/0 · i18n OK · ai:check OK · **vitest intégral OK** · build prod OK ·
  **smoke HTTP 95/95**.

## 4. Vérification runtime (serveur réel, `:3000`)

- **T-269** — scénario hôte complet sur « Resort Les Dunes » (Chambre Standard,
  2027-03-10 → 12) : demande créée (201, `MBB-2026-L8MZ17`) → confirmation hôte (200) →
  base : `confirmed_at = 18:00:04.884` posée dans la transaction → `markPaidOffline` (200,
  `payment_status = paid`) → base : `updated_at = 18:00:13.865` (+ 9 s) et
  **`confirmed_at` inchangée** → fiche dashboard (HTML réel, session hôte) : l'étape
  « Demande confirmée » porte « 11 sept. 2026, 18:00 » (la date de confirmation, pas le
  dernier update).
- **T-270** — 30 fils créés pour le compte client (fixture purgeée après coup) :
  `GET /messages` (session client réelle) **200** : « **25 résultats affichés sur 30** »,
  lien « Afficher 25 de plus » (`limit=50`) et « Tout afficher (30) » ;
  `GET /messages?limit=100` **200** : les 30 fils rendus avec leur dernier message en
  aperçu, bandeau absent.
- (Lot B, même passe) le label « à traiter par l'hébergeur » de T-266 reste intact sur
  `/mes-reservations` après annulation.

## 5. Portée

- **T-269** : colonne additive nullable, écrite uniquement par la transaction de
  confirmation. Aucun autre chemin d'écriture de `bookings` est modifié ; les fiches sans
  `confirmed_at` (historiques) rendent exactement l'affichage d'avant (repli
  `updated_at ?? created_at`). La timeline n'est lue que par la fiche dashboard.
- **T-270** : le périmètre SQL (participant + visibilité + recherche) reproduit mot pour
  mot la règle JS existante — les fils vides > 7 jours restaient masqués avant et restent
  masqués **et non comptés** ; le tri `last_message_at desc` est conservé ; la recherche
  porte sur les fils chargés (contrat T-245, comme les 8 écrans précédents). Le
  composant `ShowMore` est celui du contrat, avec les libellés `list.window.*` existants.
- **T-257 (test)** : seul le calcul du total attendu change (comptage dynamique plutôt que
  23 codé en dur) ; les fixtures et les assertions de la fenêtre sont inchangées.
- Toutes les fixtures runtime (réservation d'essai, e-mails d'outbox, audit_log, 30 fils
  de test, sessions) ont été purgées après vérification : base revenue à l'état seed exact
  (8 properties / 8 users / 33 bookings / 0 outbox / 0 audit_log / 0 conversations /
  0 sessions).

> Note d'infrastructure : la purge de fin de smoke a effacé la base embarquée (`.data/`)
> et le process Postgres dev en cours de route ; la base a été re-seedée
> (`db:push` + `POST /api/seed`) et un `.env.local` local (gitignored) a été recréé
> (`DATABASE_URL`, `JWT_SECRET`, `SEED_TOKEN` générés) — l'environnement de dev est de
> nouveau complet et autonome.
