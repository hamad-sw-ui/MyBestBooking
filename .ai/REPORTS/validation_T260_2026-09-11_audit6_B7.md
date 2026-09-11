# Validation — T-260 (B7 : capacités de l'API exposées dans `/recherche`)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking`
- **Périmètre** : `sort=popularity`, note minimale, « Autour de moi » (`near`), recherche libre
  (`search`) — constat B7 de l'audit n°6.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.7

## 1. Livré

| Élément | État |
|---|---|
| Option de tri « Populaires » (`totalReviews DESC`) | ✅ `<select>` + branche d'ordre (l'API et `SORT_VALUES` la connaissaient déjà) |
| Filtre « Note minimale » (0–10, pas 0,5) | ✅ SQL `average_rating >= n` ; hors bornes → filtre ignoré + `search.warn.minRatingIgnored` |
| Bouton « Autour de moi » | ✅ `navigator.geolocation` → `near=lat,lng,25` en conservant les filtres ; refus/absence → message localisé, saisie de ville intacte |
| Puce « rayon actif » + retrait | ✅ « Autour de moi : à moins de N km » + « Retirer le rayon » (autres filtres conservés) |
| Recherche libre `search` | ✅ champ destination → `ILIKE` nom/ville/description ; `?city=` inchangé |
| Distance | ✅ SQL haversine (6371 km) **avant** `LIMIT/OFFSET` ; ordre par distance si aucun `sort` |
| i18n | +13 clés FR/EN, verrou **1749 → 1762** ; 2 avertissements (note, position) |

## 2. Preuves automatisées

- `src/lib/geo-distance.test.ts` : **8/8** — bornes de `parseNear` (13 cas invalides), haversine
  (0 sans NaN, Paris–Lyon ≈ 392 km, Paris–Marseille ≈ 660 km), `buildNearHref` (filtres conservés,
  `near`/`page` écrasés, champs vides écartés).
- `src/components/search-near-me-button.test.tsx` : **1/1** — libellé FR, `type="button"`, rayon
  annoncé, aucun message avant interaction.
- `src/lib/search-warnings.test.ts` : **+2 tests** (note hors 0–10, position invalide) — tous verts.
- `src/lib/ui-strings.test.ts` : verrou 1762, parité FR/EN — vert.
- `npx tsc --noEmit` 0 · `npx eslint . --max-warnings 0` 0/0 · **vitest complet 146 f / 812 t, 0 échec**.

## 3. Sondes runtime (dev :3000, base seed)

| Requête | Résultat observé |
|---|---|
| `?search=toscana` | titre « Résultats pour « toscana » », **1** carte (`B&B Toscana`) |
| `?search=azur` | **1** carte (`Villa Azure Côte d'Azur`) — la description/nom est bien couverte |
| `?minRating=9.5` | **2** résultats ; `?minRating=9` → **4** ; `?minRating=12` → bandeau « 0 et 10 » (filtre ignoré) |
| `?sort=popularity` | 8 résultats, premier = `Hôtel Barcelona Center` (le plus d'avis) |
| `?sort=rating` | ordre inchangé (`Resort Les Dunes` en tête) |
| `?near=43.7696,11.2558,50` | **1** carte (`B&B Toscana`) + puce « Autour de moi : à moins de 50 km » |
| `?near=48.8566,2.3522,25` | **2** cartes parisiennes, classées du plus proche au plus loin |
| `?near=abc` | bandeau « position « autour de moi » invalide » |
| `?city=Paris` (lien historique) | **2** cartes, titre « Hébergements à Paris » — non régressé |
| EN (cookie `mybb-ui-language=en`) | « Popular », « Minimum rating », « Near me », « within 50 km », « Remove radius » |

## 4. Portée

Aucune route API, aucun contrat ni migration modifiés : les capacités existaient, elles sont
désormais **utilisables** et leurs entrées invalides **dites**. Les liens historiques (`city`,
`sort`, `page`) produisent les mêmes résultats qu'avant.
