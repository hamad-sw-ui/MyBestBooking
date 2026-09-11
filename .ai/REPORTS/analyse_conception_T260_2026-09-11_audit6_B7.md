# Analyse de conception — T-260 (B7)

- **Date** : 2026-09-11 · **Tâches courantes** : T-260 · **Niveau** : S
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.7

## 1. Problème

Quatre capacités de `GET /api/properties` n'ont aucun chemin d'interface : `sort=popularity`,
`minRating` (0–10), `near=lat,lng,km` (T-026) et `search`. Preuves d'exécution de l'audit :
`?sort=popularity&limit=3` → 200 (3), `?minRating=9.2` → 200 (4), `?near=48.86,2.35,50` → 200 (2),
`?search=toscana` → 200 (1), alors que le formulaire (`page.tsx:415-419`) n'envoyait que
`rating | price_asc | price_desc`. Depuis T-259 les coordonnées sont saisissables : le filtre de
distance devenait utilisable mais restait sans bouton, et une note minimale tapée dans l'URL était
silencieusement honorée sans que rien ne l'annonce.

## 2. Options

| Sujet | Option | Verdict |
|---|---|---|
| Tri | ajouter l'option au `<select>` | **Retenue** : la valeur est déjà traitée par l'API et par `SORT_VALUES` (T-249) |
| Note | `<select>` 0,5–10 (20 entrées) vs `<input type="number" step=0.5>` | **Input retenu** : même bornes que l'API, pas de liste interminable, avertissement si hors 0–10 |
| « Autour de moi » | géocodage d'une ville saisie vs `navigator.geolocation` | **Géolocalisation retenue** (demande explicite de l'audit) avec repli sur la saisie de ville ; aucun service externe |
| Distance | filtrage JS sur un jeu large (comme l'API) vs SQL | **SQL retenu** : la page pagine en SQL ; filtrer en JS après `LIMIT` aurait cassé `total`/`totalPages` |
| `search` | brancher (nom **ou** ville **ou** description) vs documenter l'abandon | **Branché** : le champ destination portait déjà « Ville ou hébergement » ; `city` reste accepté tel quel pour ne pas casser les liens |
| `near` sans tri | ordre par note (défaut historique) vs distance croissante | **Distance retenue** : attendu d'un « autour de moi » ; seulement quand aucun `sort` n'est fourni (URL nouvelle, aucune régression) |

## 3. Conception retenue

- **Brique pure** `src/lib/geo-distance.ts` : bornes (−90..90 / −180..180, `km > 0`), normalisation
  pour la clé de cache, haversine identique à l'API, construction d'URL conservant les filtres
  (champs vides et `page` écartés).
- **Filtrage** dans `searchProperties` : `search` → `ILIKE` nom/ville/description ; `minRating` →
  `average_rating >= n` ; `near` → distance SQL `<= km` + lat/lng non nuls, avec ordre par distance
  si aucun tri explicite.
- **Formulaire** : destination `name="search"` (défaut `search` sinon `city`), tri « Populaires »,
  note minimale, bouton « Autour de moi » (client, `useT()`), puce « Autour de moi : à moins de
  N km » + lien « Retirer le rayon » qui conserve les autres filtres.
- **Avertissements** : note hors bornes et position invalide rejoignent le bandeau T-175.

## 4. Limites assumées

- Pas de tri par distance **explicite** dans le `<select>` (l'ordre par distance s'applique sans tri) :
  ajouter une 5ᵉ valeur de tri exigerait de la faire accepter par l'API, hors périmètre.
- Pas de carte visuelle (constat inchangé, backlog UX) ; le rayon n'est pas affiché sur les cartes.
- Le bouton exige le consentement de géolocalisation : le repli (saisie de ville) reste la voie
  principale, inchangée.
