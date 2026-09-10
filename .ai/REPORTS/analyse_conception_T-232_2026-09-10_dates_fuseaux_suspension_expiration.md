# Analyse de conception — T-232 / T-233 / T-234 (+ volet T-240) — audit n°3

- **Date** : 2026-09-10
- **Niveau** : C — rapport exigé par `CODING_RULES.md` §15.1
- **Analyse source** : `docs/analyse_2026-09-10_audit_runtime_scenarios.md` (F1→F13)
- **Impact** : `REPORTS/analyse_impact_T-232_2026-09-10_dates_fuseaux_suspension_expiration.md`
- **Validation** : `REPORTS/validation_T232_T234_2026-09-10_dates_suspension_expiration.md`

## 1. Principe directeur

Trois constats, **une seule cause commune** : une information dont le sens dépendait d'un contexte
implicite (le fuseau du process, le cache d'un bundle, le calendrier du cron) plutôt que d'une
règle explicite. La conception consiste donc à **poser la règle en un point unique** et à faire
dépendre les consommateurs de cette règle, sans dupliquer la logique :

| Constat | Contexte implicite | Règle posée |
|---|---|---|
| F1/F9/F10 (T-232) | fuseau du runtime serveur | `src/lib/dates.ts` : date **civile** vs **instant** |
| F2 (T-233) | cache du bundle appelant | hôte actif = prédicat unique + cache partagé invalidé |
| F3 (T-234) | horloge du **cron** | expiration = fonction partagée, exécutable dans la transaction appelante |

## 2. Décisions de conception

### 2.1 T-232 — deux natures de dates, jamais mélangées

Une colonne `date` (arrivée, départ, jour de calendrier) est une **date civile** : elle n'a pas
d'instant, donc pas de fuseau. Un `timestamptz` (création, échéance, horodatage d'audit) est un
**instant** : il s'affiche dans un fuseau explicite (UTC par défaut, `users.timezone` quand un
fuseau d'affichage est configuré). Le helper rend cette distinction **structurelle** :

- `formatCivilDate(value, options, locale)` interprète la chaîne en UTC et formate en UTC → le jour
  affiché est exactement celui fourni, quel que soit le runtime ;
- `formatTimestamp(value, { timeZone }, locale)` exige un fuseau (UTC par défaut) → plus de
  dépendance à l'horloge locale ;
- `pg` rend les colonnes `date` en **chaînes** (`setTypeParser(1082)`), ce qui supprime à la source
  la fabrication d'un `Date` à minuit local par le pilote.

`src/lib/utils.ts` conserve `formatDate`/`formatDateShort` comme façade (des centaines d'appels
existants), mais délègue : la règle vit à un seul endroit.

### 2.2 T-233 — cascade transactionnelle + exactitude indépendante du cache

1. **Cascade** : `suspendHostListings`/`reactivateHostListings` s'exécutent **dans la même
   transaction** que la suspension du compte. Idempotentes (elles ne touchent que les annonces dans
   l'état attendu et retournent les identifiants réellement modifiés), elles n'écrivent pas de
   statut « précédent » : le modèle `active ↔ suspended` suffit et évite une colonne supplémentaire.
2. **Prédicat public unique** : `activeHostCondition` (SQL typé) est partagé par la recherche, la
   fiche et le tunnel — un seul endroit à corriger si la règle change.
3. **Cache** : le défaut observé (fiche encore en 200 après suspension) venait de **deux instances
   du module de cache** — la page et la route API compilent des bundles distincts, donc
   l'invalidation pilotée par la route n'atteignait jamais l'instance lue par la page. Deux
   correctifs complémentaires :
   - **structurel** : le cache est ancré sur `globalThis.__mbbPublicCatalogCache` (même technique que
     le pool `pg`), donc partagé par tous les bundles du process ;
   - **défensif** : la fiche vérifie la visibilité **hors cache** (`isPropertyPubliclyVisible`,
     une ligne) — l'exactitude d'une page sensible ne dépend plus de la fraîcheur d'un cache.
4. **Invalidation ciblée** : suspension unitaire (si des annonces ont été touchées) et bulk (si au
   moins une action a réussi) appellent `invalidatePublicCatalog` ; `keys()` a été ajouté à
   l'interface `TtlCache` pour permettre la purge réellement effective des entrées expirées.

### 2.3 T-234 — l'expiration devient une fonction, pas un calendrier

Le constat F3 est un **effet de bord du découpage** : la purge existait, complète (remboursement du
portefeuille, rendu d'usage de la promotion, motif, notification), mais vivait **dans la route du
cron**. Elle est extraite dans `src/lib/booking-request-expiration.ts` avec trois niveaux :

- `expireRequestInExecutor(executor, id, now)` : le cœur, agnostique de l'appelant (transaction
  Drizzle ou `db`), avec verrou pessimiste (`for update`) et **relecture** des conditions
  d'éligibilité — deux processus concurrents ne peuvent ni expirer deux fois la même demande, ni
  expirer une demande tout juste confirmée ;
- `expireRequestsInTransaction(executor, now, scope)` : sélection bornée (statut, paiement,
  absence de `paymentIntentId`, échéance dépassée) et, si un scope est fourni, restreinte à la
  **chambre** et à la **fenêtre** demandées — le tunnel ne purge que ce qui le concerne ;
- `expireManualBookingRequests(now, onExpired)` : la tâche de fond d'origine, une transaction par
  candidat, notification déléguée à l'appelant.

Le tunnel appelle la variante transactionnelle **avant** le calcul des chevauchements (le contrôle
ignore `pending` : une demande morte comptait donc encore comme occupante) et **notifie après
commit**, dans un `try/catch` best-effort. Le devis fait de même pour ne pas annoncer
« indisponible » sur une demande expirée.

À la **lecture** (calendrier hôte, API de disponibilité), `loadBookedCounts` exclut désormais une
demande `pending` sans `payment_intent_id` dont `request_expires_at <= now()` : la lecture est
immédiatement juste, sans écriture implicite (une lecture qui écrirait serait une surprise en
cascade). Le cron reste le balai global.

### 2.4 T-240 — l'horizon métier est explicite

Les derniers `new Date().toISOString().slice(0, 10)` servant d'« aujourd'hui » métier
(`sendPaymentReminders`, `future-stay`, `room-remaining`, `search-warnings`) passent à
`civilToday("UTC")` : même valeur, mais l'intention est nommée et testable. Les tests multi-fuseaux
sur `transitionError`/`isReviewEligible` verrouillent la décision (même résultat, même message sous
`UTC`, `Africa/Douala`, `America/Los_Angeles`, `Pacific/Kiritimati`).

## 3. Ordre de mise en œuvre

1. Helpers de dates + parser `pg` (fondation, aucun consommateur modifié) ;
2. câblage des surfaces d'affichage, puis retrait des derniers `toLocaleDateString` ;
3. cascade de suspension + prédicat public, puis cache partagé et garde hors cache ;
4. extraction de la purge d'expiration, branchement du cron (sans changement de contrat), puis
   tunnel/devis et lecture de stock ;
5. tests (unitaires, intégration avec non-vacuité), runtime, portes CI, documentation.

## 4. Stratégie de test

- **Unitaire/pur** : `dates.test.ts` (7 tests, 4 fuseaux), volet T-240 (4 tests multi-fuseaux).
- **Intégration** : `host-suspension.test.ts` (5 tests : cascade, idempotence ×2, isolation d'un
  autre hôte, restauration exacte) et `route.t234.test.ts` (2 tests : purge + 201, non-régression du
  blocage par une demande **valide**, lecture de stock).
- **Non-vacuité** : le test T-234 a été rejoué **sans** le correctif → `409` reproduit, puis avec →
  `201`. Un test qui ne échoue jamais ne prouve rien.
- **Runtime** : trois sondes HTTP/PostgreSQL (fiche, recherche API + page, tunnel, disponibilité),
  base comparée au seed avant/après.

## 5. Rollback

Chaque bloc est indépendant : retirer l'appel à `expireRequestsInTransaction` rend au tunnel le
comportement « cron uniquement » ; retirer l'invalidation rend le catalogue dépendant du TTL ;
revenir sur le parser `date` restitue les `Date`… mais réintroduit le décalage d'un jour. Les
helpers de dates n'ont pas d'état : aucune migration de retour n'est nécessaire.
