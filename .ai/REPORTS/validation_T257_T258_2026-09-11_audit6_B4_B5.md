# Validation — audit n°6, lot B (B4 → T-257, B5 → T-258)

- **Date** : 2026-09-11
- **Branche** : `arena/01a08b7d-mybestbooking`
- **Périmètre** : constats **B4** (deux écrans hors fenêtre + N+1 côté hôte) et **B5** (fiche publique
  bloquée à 5 avis, sans compteur ni lien) de l'audit n°6.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3 (B4, B5)
- **Rappel de numérotation** : lot A = B1→T-253, B2→T-254, B3→T-255, B11→T-256 (commit `11165d4`) ;
  lot B = B4→**T-257**, B5→**T-258** (ce rapport), B6→T-259 (à venir).

## 1. Ce qui a été livré

| Tâche | Constat | Livrable |
|---|---|---|
| **T-257** | B4 — `/dashboard/messages` et `/dashboard/rooms` chargeaient **toute** la liste (hors contrat de fenêtre) et la branche hôte de `rooms` faisait **une requête par bien** (N+1) | branche hôte de `rooms` réécrite en **une** jointure `rooms ⋈ properties` filtrée par `host_id` (mêmes champs, même tri `created_at desc`) + `countRooms()` ; `parsePageWindow` + `<ShowMore>` sur les **deux** écrans ; `conversationScope()` partagé par la liste **et** le compteur de conversations (les deux voient exactement le même périmètre) |
| **T-258** | B5 — la fiche publique chargeait `reviews … limit(5)` **sans** compteur ni lien, alors que `property.totalReviews` existait et que `GET /api/reviews` était déjà paginé | compteur (`property.reviewsCount`) dans l'en-tête « Avis vérifiés ✓ », lien « Voir les N avis » (`property.reviewsSeeAll`) dès que `totalReviews > 5` ; **nouvelle page** `/hebergement/[slug]/avis` (20 avis/page, `?page=`, `generateMetadata`, pagination Précédent/Suivant) ; **composant partagé** `PropertyReviewsList` (markup identique à l'ancien bloc de la fiche : réponse d'hôte, 👍/👎, pays, type de voyageur, bouton « utile ») |

### Détails B4

- **Une requête, pas N.** La branche hôte de `/dashboard/rooms` bouclait `for (const prop of hostProperties)` puis
  interrogeait `rooms` pour chacun ; elle passe par la même jointure que la branche admin (filtre `properties.hostId`
  au lieu de `properties.status`), avec `count()` pour la fenêtre.
- **La fenêtre, pas un paginateur.** Les filtres/tris/compteurs de ces deux écrans sont rendus côté client : la
  fenêtre borne donc le **chargement** (`25` par défaut, `+25`, plafond `500`) et `<ShowMore>` affiche
  « N résultats affichés sur M » — aucun `?page=` n'est introduit, les liens `?limit=` restent compatibles.
- **Périmètre partagé.** `conversationScope()` construit la condition « conversation visible » (participant +
  fenêtre de rattrapage du brouillon) : la liste et le compteur l'utilisent, donc le bandeau ne peut plus annoncer
  un total calculé sur une autre condition que la liste affichée.

### Détails B5

- **Non-régression de la fiche** : elle garde son `limit(5)` (même coût, même cache), son ordre (`created_at desc`)
  et son balisage — le bloc d'avis est simplement extrait dans `PropertyReviewsList` (aucun changement visuel).
- **Visibilité identique** : la page dédiée réutilise `getPropertyForReviews` (bien `active` + hôte actif ;
  l'hôte propriétaire et l'admin conservent l'accès à une annonce non publiée) → un lien de la fiche ne peut pas
  mener sur un 404, et un slug inconnu répond **404** comme la fiche.
- **Clé orpheline résorbée** : le titre de la page (`H1`, `aria-label` de la pagination, `generateMetadata`)
  réutilise **`property.reviews`** (« Avis » / « Reviews »), qui n'était utilisée nulle part depuis T-132 — le
  correctif recommandé par l'audit est appliqué à la lettre.

## 2. i18n

- **3 clés ajoutées**, FR **et** EN appariées, avec commentaire d'historique :
  `property.reviewsCount` (« {n} avis » / « {n} reviews »), `property.reviewsSeeAll` (« Voir les {n} avis » /
  « See all {n} reviews »), `property.backToProperty` (« Retour à l'hébergement » / « Back to the property »).
- Verrou `src/lib/ui-strings.test.ts` : **1739 → 1742** (+3) ; `property.reviews` n'ajoute aucune clé.

## 3. Preuves automatisées

- `src/app/dashboard/list-window.t257.test.ts` — **3/3** (base réelle, rendu RSC) :
  1. 23 chambres ≤ fenêtre → **aucun** bandeau, la liste complète est servie par la jointure ;
  2. 26 lignes (23 seed + 3 créées) → **« 25 résultats affichés sur 26 »** + bouton « Afficher 25 de plus » ;
  3. idem côté messages (26 fils) → même bandeau, compteur aligné sur la liste.
- `src/app/(main)/hebergement/reviews-page.t258.test.ts` — **3/3** (base réelle, fixtures créées puis purgées,
  agrégats recalculés) :
  1. fiche d'un bien à **24 avis approuvés** : compteur « 24 avis », lien `/hebergement/b-b-toscana/avis`,
     « Voir les 24 avis », et **toujours 5 avis** dans la section (l'avis n° 5 des fixtures est absent) ;
  2. page dédiée : « page 1 sur 2 » + `?page=2`, page 1 = les 20 plus récents, page 2 = la fin de liste ;
  3. slug inconnu → `notFound()`.
- `src/lib/ui-strings.test.ts` — 7/7 (parité FR/EN + verrou 1742).
- `npx tsc --noEmit` : **0 erreur** ; `npx eslint src --max-warnings 0` : **0/0**.
- **`npm run ci` (chaîne complète) : VERTE** — typecheck 0 · lint 0/0 · `i18n:check` 6 candidats
  (pré-existants, aucun dans les fichiers du lot) · **`ai:check` 20 OK / 0 warn / 0 fail** (R12
  satisfaite par les rapports d'impact et de conception T-257/T-258) · vitest **138 fichiers passés
  / 2 ignorés (140) — 761 tests passés / 28 ignorés (789)**, soit +6 tests et +2 fichiers depuis
  `11165d4` · build production « Compiled successfully » + 67 pages statiques · smoke **95/95**.
  Les trois passes de CI de la session ont la même conclusion (la dernière porte sur l'arbre commité,
  à un commentaire près — reformulé pour ne pas ajouter de candidat i18n).

## 4. Garanties de non-régression

- Aucune route API modifiée, aucune migration, aucun changement de schéma (B4/B5 sont **page + requêtes**).
- Les écrans déjà fenêtrés (7 écrans T-245/246) ne sont pas touchés ; les deux nouveaux rejoignent le même
  helper `parsePageWindow`, donc mêmes libellés (`show.*`), mêmes bornes et même plafond.
- La fiche publique conserve sa requête, son ordre et son cache TTL 60 s ; la page d'avis est `force-dynamic`
  (elle lit `?page=`, comme les autres pages paginées) et ne consomme que des colonnes déjà lues par la fiche.
- Aucun libellé existant réécrit ; les 3 clés ajoutées sont additives (verrou mis à jour dans le même commit).

## 5. Sondes runtime (serveur de développement réel, base démo)

| Sonde | Résultat |
|---|---|
| `/dashboard/rooms` (session hôte, 23 chambres) | **200**, **aucun** bandeau (la fenêtre de 25 n'est pas franchie) |
| `POST /api/rooms` ×3 puis `/dashboard/rooms` | **200** avec **« 25 résultats affichés sur 26 »** + « Afficher 25 de plus » — la fenêtre et le compteur sont exacts ; `?limit=50` → 26/26, **aucun bandeau** (compat des liens T-245) |
| `DELETE /api/rooms/<id>` ×3 | **200 ×3** — retour à 23 chambres |
| `/dashboard/messages` (hôte) | **200**, aucun bandeau (aucune conversation dans le seed : le compteur vaut 0, la fenêtre ne s'affiche pas) |
| Fiche seed (`b-b-toscana`, 2 avis) | compteur « 2 avis » affiché, **aucun** bouton « Voir les N avis » (comportement inchangé sur les biens ≤ 5 avis) |
| Fiche portée à **24 avis** (22 avis de sonde + agrégats recalculés) | après expiration du cache 60 s : **« 24 avis »** + **« Voir les 24 avis »** vers `/hebergement/b-b-toscana/avis`, et **5 avis** seulement dans la section (fenêtre conservée) |
| `/hebergement/b-b-toscana/avis` | **page 1** = 20 avis + « page 1 sur 2 » + lien `?page=2` ; **page 2** = fin de liste + « Précédent » |
| Même page en **anglais** (`mybb:ui-language=en`) | **200**, H1 « Reviews », `Back to the property`, `<title>Reviews — B&B Toscana` |
| `/hebergement/slug-inexistant/avis` | **404** |
| Ménage | avis de sonde supprimés + agrégats recalculés (retour à 2 avis / 9.8), chambres de sonde supprimées, résidus de CI purgés (6 comptes `@test.local` + jetons, 1 réservation, 1 alerte prix, 1 favori) |

## 6. Base de données après les tests

Fixtures supprimées et agrégats recalculés par `afterAll` : chambres et conversations créées par les runs
T-257 supprimées, 22 avis de fixture supprimés puis `recomputePropertyReviewAggregate` rejoué, sondes runtime
purgées. **État final vérifié** : 8 users / 8 annonces / **23 rooms** / 30 réservations / 21 avis /
`wishlist_items` 0 / `price_alerts` 0 / `conversations` 0 (`email_outbox` 164 conservé comme journal).
