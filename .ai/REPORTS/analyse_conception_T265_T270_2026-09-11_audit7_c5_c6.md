# Analyse de conception — T-265 → T-270 (audit n°7, C1 → C6)

- **Date** : 2026-09-11
- **Source** : `docs/analyse_2026-09-11_audit_runtime_n7_fins_de_parcours.md`
- **Analyse d'impact** : `.ai/REPORTS/analyse_impact_T265_T270_2026-09-11_audit7.md` (§14)
- **Objectif** : corriger les six constats de l'audit n°7 sans régression, en réutilisant les
  briques existantes (contrat de fenêtre T-245/T-257, règle pure de visibilité T-217/P7,
  outbox, i18n, `formatDate` T-232) plutôt qu'en introduisant de nouveaux mécanismes.

> Les lots A et B (T-265 → T-268) sont livrés et validés
> (`validation_T265_T266_2026-09-11_audit7_C1_C2.md`,
> `validation_T267_T268_2026-09-11_audit7_C3_C4.md`) ; leurs décisions y sont tracées.
> Le présent document porte la **conception détaillée du lot C** (T-269, T-270), le seul
> non encore documenté à ce niveau, avec un rappel synthétique des quatre premiers.

## Rappel — T-265 → T-268 (lots A/B, décisions déjà livrées)

- **T-265 (C1)** : la re-vérification du bien/chambre est faite **dans la transaction de
  confirmation** (re-lecture `properties.status` + `rooms.isActive`), pas en avant du PUT —
  l'alternative « vérifier puis écrire » laissait une course avec une suspension simultanée ;
  en transaction, la re-vérification et l'écriture partagent le même instant logique
  (le `409` est la seule issue pour un bien sanctionné).
- **T-266 (C2)** : l'état `pending` du remboursement hors plateforme reste un état (il est
  honnête : l'argent n'est pas encore rendu), mais il est **relabelé** « à traiter par
  l'hébergeur » et une action hôte le fait basculer `refunded` (e-mail voyageur) — le
  « en cours » sans issue disparaît sans toucher le champ `refundAmount`.
- **T-267 (C3)** : swap du placeholder par un visuel neutre dédié (zéro code pour les
  consommateurs) + état vide explicite sur la fiche quand l'annonce n'a **aucune** photo —
  la condition rendue est exactement celle du placeholder, pas une nouvelle sémantique.
- **T-268 (C4)** : `emailVerified: true` posé **uniquement** dans la branche `claimGuest`
  (spread conditionnel, même transaction) — le claim prouve la maîtrise de la boîte, donc la
  vérification est acquise ; les autres flux (reset, inscription) ne changent pas.

## T-269 (C5) — « l'étape confirmée de la timeline glissait après un markPaidOffline »

**Décision : la date de confirmation est un état persisté, pas un dérivé.**

| Option | Écartée / retenue | Pourquoi |
|---|---|---|
| (a) `confirmed_at` colonnes, posée à la confirmation | **Retenue** | C'est l'unique moment où la vérité est connue ; un dérivé la perd à la première mutation subséquente |
| (b) re-calculer depuis l'audit log / e-mail | Écartée | Rejouer l'historique pour re-dériver une date est fragile (e-mails supprimés par la rétention T-243, audit log sans date d'étape fiables) et coûte à chaque rendu |
| (c) geler `updated_at` pendant l'état confirmed | Écartée | `updated_at` doit refléter le dernier changement réel (`markPaidOffline` est un changement) ; le geler corromprait les autres consommateurs (tri, « modifiée le ») |

- **Position dans le code** : `confirmed_at = now()` est écrit dans la même transaction que
  `status = 'confirmed'` / `confirmed_by` (PUT `POST /api/bookings/[id]`, branche
  `data.status === "confirmed"`) — aucune autre écriture ne la touche ; `markPaidOffline`
  et les autres mutations avancent `updated_at` **sans la décaler** (preuve test : stabilité
  mesurée après un update > 2 s).
- **Rendu** : la timeline lit `booking.confirmedAt ?? booking.updatedAt ?? booking.createdAt`.
  Les lignes historiques (`NULL`) replient sur l'ancien affichage — **inchangé**, aucune
  réécriture de données (pas de backfill : dériver rétrospectivement une « date de
  confirmation » depuis `updated_at` serait inventer une vérité, le repli l'assume).
- **Migration** : `drizzle/0026_bookings_confirmed_at.sql` additive
  (`ADD COLUMN IF NOT EXISTS confirmed_at timestamp`), nullable, sans défaut — applicable
  sur chaîne fraîche et sur base existante ; rollback = suppression de la colonne
  (l'écriture est ignorée si la colonne disparaît, la timeline replie sur `updated_at`).

## T-270 (C6) — « /messages en 1+N requêtes, sans fenêtre »

**Décision : batcher, borner, et faire porter la même condition SQL à la liste et au compteur.**

### 1. Une requête pour les derniers messages (fin du 1+N)

L'ancien code faisait, par fil de la fenêtre, `SELECT … FROM messages WHERE
conversation_id = $1 ORDER BY created_at DESC LIMIT 1`. Le remplacement :

- **une** requête `SELECT … FROM messages WHERE conversation_id IN (…ids de la fenêtre…)
  ORDER BY created_at DESC`, puis premier message par fil en JS (le tri donne le plus
  récent) ;
- alternative écartée : sous-requête corrélation `DISTINCT ON (conversation_id)` — plus
  élégante en SQL, mais la fenêtre est déjà bornée (25 ids) : une IN-liste lisible et
  indexée (`conversation_id`) fait le même travail sans dialecte ;
- le test verrouille la régression par **comptage des requêtes sur le pool** : 0 requête de
  forme `conversation_id = $N`, 1 requête IN-liste — pas un test de timing (instable), une
  preuve structurelle.

### 2. La fenêtre (contrat T-245, 9ᵉ écran rattrapé)

- `parsePageWindow` (25 par défaut, `queryLimit = size + 1`, plafond 500) + `<ShowMore>`
  existants — zéro nouvelle brique ; la fenêtre borne le **chargement** (`limit` en SQL),
  pas la recherche : les filtres portent sur les résultats affichés, comme les 8 écrans
  déjà couverts (contrat T-245) ;
- `hasMore` est déduit du `+1` (26 lignes renvoyées → il en reste) — même mécanique que
  `/dashboard/bookings`.

### 3. Une condition, deux usages (le « N sur M » ne ment pas)

Le bandeau `ShowMore` affiche `total` — si la liste et le compteur appliquaient des
conditions différentes, le compteur mentirait (ex. compter des fils vides anciens que la
liste masque). La règle est donc factorisée en **une** fonction de prédicat
(`conversationConditions(userId, needle)`) :

- **participant** : `user_id = moi` OU `properties.host_id = moi` (jointure, comme avant) ;
- **visibilité** : `EXISTS(message) OR created_at > now() - 7 jours` — **miroir exact** de
  `isConversationVisible` (T-217/P7, `EMPTY_THREAD_VISIBLE_DAYS` importé du module de règle
  pure — un seul endroit décide la durée) ;
- **recherche** : `ilike(nom) OR ilike(ville) OR EXISTS(dernier message contenant …)` —
  miroir du filtre JS (nom/ville du bien, contenu du **dernier** message ; le sous-filtre
  `created_at = max(created_at)` reproduit le `ORDER BY created_at DESC LIMIT 1` ancien).

Le garde-fou JS (règle pure + filtre recherche) est **conservé** tel quel derrière la
fenêtre : même sémantique que le SQL, zéro changement de comportement observable pour un
compte existant, et un éventuel écart résiduel (messages créés dans la même milliseconde)
ne peut que masquer une ligne, jamais en afficher une interdite (fail-safe).

### Portée non régressive

- Tri `last_message_at DESC`, jointures, aperçus, compteurs de non-lus : inchangés ;
- les fils vides > 7 jours étaient masqués avant → restent masqués **et** ne sont plus
  comptés (le compteur est neuf avec le bandeau : pas de changement d'un compteur existant) ;
- aucun contrat d'API modifié (`/api/messages`/`/api/conversations` intacts) — seul le
  rendu RSC de `/messages` change.
