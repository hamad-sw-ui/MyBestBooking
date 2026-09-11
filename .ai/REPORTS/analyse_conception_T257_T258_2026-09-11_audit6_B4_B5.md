# Analyse de conception — T-257 / T-258 (audit n°6, lot B : B4 + B5)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking`
- **Tâche courante** : T-257 (B4) et T-258 (B5), niveau **S** (correctifs non régressifs de fin de parcours)
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.4 et § 3.5
- **Contraintes produit** : parité FR/EN, aucune régression, pagination **opt-in** de l'API, le gel du
  wallet T-248 §3 n'est pas concerné (aucun montant touché ici).

## 1. Problèmes à résoudre

1. **B4 — deux écrans hors contrat.** `parsePageWindow` + `<ShowMore>` (T-245) couvrent 7 écrans ; deux
   restent en chargement intégral : `/dashboard/messages` (toutes les conversations) et
   `/dashboard/rooms` (toutes les chambres). Le second cumule un **N+1** : la branche hôte boucle sur
   ses biens et interroge `rooms` une fois par bien (`grep -n "for (const prop"` → présent avant
   correctif).
2. **B5 — cinq avis pour toujours, sans le dire.** La fiche publique charge `reviews … limit(5)` ; la
   section « Avis vérifiés » n'affiche ni compteur ni lien, alors que `properties.total_reviews` existe,
   qu'il est déjà affiché dans le bandeau haut (`card.reviewsCount`) et que `GET /api/reviews` est
   **déjà paginé** (`limit`/`offset`). La clé `property.reviews` (« Avis » / « Reviews ») est orpheline
   depuis T-132.

## 2. Options envisagées

### B4 — fenêtrer sans casser les filtres

| Option | Avantage | Inconvénient | Décision |
|---|---|---|---|
| `?page=N` (pagination serveur) | URL partageable | **Régression** : ces écrans filtrent/trient/comptent côté client → filtres partiels et compteurs faux (c'est le constat qui a fondé la fenêtre T-245) | **Écartée** |
| Composant de liste virtuelle côté client | Aucun coût serveur | Réécriture de deux managers, pas de gain réseau (les lignes sont déjà chargées) | **Écartée** |
| **Fenêtre de chargement** (`parsePageWindow` + `<ShowMore>`) | Contrat **déjà** en place sur 7 écrans, mêmes libellés, liens `?limit=` conservés | Un utilisateur doit élargir pour voir plus loin (le bandeau le dit) | **Retenue** |
| Conserver la boucle par bien et la fenêtrer | Aucun refactor SQL | Le N+1 reste, et la fenêtre tronquerait par bien (liste non déterministe) | **Écartée** |

### B5 — rendre les avis complets

| Option | Avantage | Inconvénient | Décision |
|---|---|---|---|
| Augmenter la fenêtre de la fiche (20 ou 50 avis) | Une seule page | Charge inutile pour tous les visiteurs, ne règle rien au-delà de 50 | **Écartée** |
| « Tout afficher » client (`ShowMore` sur la fiche) | Réutilise l'existant | Chargerait N avis dans la fiche sans pagination serveur | **Écartée** |
| **Compteur + lien + page dédiée paginée** | La fiche garde son coût et son cache ; la page dédiée pagine côté serveur ; SEO (`generateMetadata`) | Une route de plus à maintenir | **Retenue** |
| Réutiliser `ReviewHelpfulButton` seul, titre `property.reviewsAllTitle` (nouvelle clé) | Libellé plus explicite | Ajoute une clé alors que `property.reviews` est orpheline — l'audit demandait de la résorber | **Écartée** |

## 3. Conception retenue

### 3.1 B4 — une requête, un périmètre, une fenêtre

- **`/dashboard/rooms`** : la branche hôte passe par la même jointure `rooms ⋈ properties` que la
  branche admin, avec `eq(properties.hostId, userId)` au lieu d'un filtre de statut. `countRooms()` fait
  le `count()` sur la **même** condition (une jointure, un `where`). Conséquence assumée : l'ordre
  devient globalement `created_at desc` (au lieu d'un groupement par bien) — cohérent avec la fenêtre et
  avec la colonne « Hébergement » de la table.
- **`/dashboard/messages`** : `conversationScope()` construit la condition « liste visible » (fil non
  vide, T-206/F9 + conversations des biens de l'hôte) ; la **liste** et le **compteur** l'utilisent, donc
  le bandeau « N résultats affichés sur M » ne peut pas annoncer un total calculé différemment.
- **Fenêtre identique aux 7 autres écrans** : `parsePageWindow(?limit)` (25 par défaut, +25, plafond 500,
  `queryLimit = size + 1` pour savoir s'il reste des lignes) et `<ShowMore>` avec les clés `list.window.*`
  existantes — **aucune clé i18n nouvelle**.

### 3.2 B5 — compteur, lien, page dédiée, rendu partagé

- **Fiche** : l'en-tête affiche `property.reviewsCount` (« 24 avis ») à côté de « Avis vérifiés ✓ » (le
  compteur du bandeau haut `card.reviewsCount` reste inchangé) ; le bouton « Voir les 24 avis »
  (`property.reviewsSeeAll`) n'apparaît que si `total_reviews > reviews.length`, donc **jamais** sur les
  biens du seed (2–4 avis) : aucune fiche existante ne change visuellement.
- **Page `/hebergement/[slug]/avis`** : `force-dynamic` (elle lit `?page=`, comme les autres écrans
  paginés), `PAGE_SIZE = 20`, requête `approved` triée `created_at desc` + `count()` en parallèle ;
  `page` est borné par `totalPages` (une URL `?page=999` retombe sur la dernière page au lieu d'afficher
  un vide) ; `generateMetadata` réutilise le même titre que la page.
- **Visibilité** : `getPropertyForReviews(slug, viewerId, isAdmin)` reprend la règle de la fiche
  (bien `active` + hôte non suspendu/supprimé ; l'hôte propriétaire et l'admin voient les annonces non
  publiées) → le lien de la fiche ne peut pas mener à un 404, et un slug inconnu reste un 404.
- **Rendu partagé** : `PropertyReviewsList` reçoit `reviews`, `locale`, `t`, `viewerId` et restitue
  exactement l'ancien balisage (initiale, nom, type de voyageur, pays, note, 👍/👎, réponse d'hôte,
  date, bouton « Utile »). La fiche n'a plus de balisage d'avis en double : un changement futur ne
  pourra plus diverger entre les deux surfaces.
- **i18n** : titre de la page et `aria-label` de la pagination = clé existante `property.reviews` ;
  pagination = `search.prev` / `search.next` / `search.pageShort` / `search.pageOf` (déjà utilisées par
  la recherche) ; +3 clés seulement (`property.reviewsCount`, `property.reviewsSeeAll`,
  `property.backToProperty`), FR et EN appariées, verrou **1739 → 1742**.

## 4. Dette et limites restantes (assumées)

- **La fiche reste bornée à 5 avis** : c'est un choix (coût et cache TTL 60 s). Le compteur et le bouton
  rendent la troncature explicite ; le `JSON-LD` publie déjà le total réel.
- **Les filtres de `rooms`/`messages` restent client** : la fenêtre borne donc ce qui est filtrable — le
  bandeau `ShowMore` le dit, comme sur les 7 autres écrans. Une pagination serveur de ces deux écrans
  impliquerait de déplacer filtres/compteurs côté serveur (hors périmètre du lot B).
- **Pas de `ShowMore` sur la page d'avis** : elle utilise une pagination serveur classique
  (« Précédent / page X sur Y / Suivant »), plus adaptée à une page de lecture indexable.
