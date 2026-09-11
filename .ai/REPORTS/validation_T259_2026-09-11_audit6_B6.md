# Validation — T-259 (audit n°6, B6 : description EN, région, coordonnées)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking`
- **Périmètre** : constat **B6** — des colonnes publiques que personne ne pouvait remplir.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.6

## 1. Livré

| Élément | Changement |
|---|---|
| `descriptionEn` | acceptée par les schémas POST/PUT (≤ 4 000) et **saisissable** dans l'éditeur (onglet Informations) avec phrase de repli FR |
| `state` | bornée à 100 (colonne `varchar(100)`) et saisissable **à la création** et dans l'éditeur |
| `latitude` / `longitude` | validées (−90..90 / −180..180), virgule décimale acceptée puis normalisée, `""` ⇒ `null`, saisissables dans l'éditeur, affichage sans zéros inutiles |
| Page `[id]` | transmet les quatre colonnes à l'éditeur (sinon l'enregistrement les aurait **effacées**) |
| i18n | +6 clés FR/EN (`prop.descriptionEn`, `prop.descriptionEnHint`, `prop.state`, `prop.latitude`, `prop.longitude`, `prop.coordinatesHint`) — verrou **1742 → 1748** |
| Aucune migration | colonnes déjà présentes dans `schema.ts` (215, 219, 222-223) |

## 2. Preuves automatisées

- `src/app/api/properties/route.t259.test.ts` **4/4** (base réelle) : persistance (virgule « 43,769 »
  → `43.76900000`), refus hors bornes et région > 100 (400, **rien n'est écrit**), effacement par
  chaîne vide puis relecture via `toPublicProperty`, acceptation de la région à la création (POST).
- `src/lib/coordinates.test.ts` **3/3** : bornes, virgule, chaîne vide ⇒ `null`, `displayCoordinate`
  (« 43.76900000 » → « 43.769 », valeur non numérique rendue telle quelle).
- `src/lib/ui-strings.test.ts` **7/7** (parité FR/EN + verrou 1748).
- `npx tsc --noEmit` 0 · `npx eslint src --max-warnings 0` 0/0 · **vitest complet 142 fichiers /
  796 tests, 0 échec**.

## 3. Sonde runtime (serveur réel, base démo)

| Étape | Résultat |
|---|---|
| `GET /dashboard/properties/<id>` (session hôte) | les quatre libellés sont rendus (« Description (EN) », « Région / État », « Latitude », « Longitude ») |
| `PUT /api/properties/<id>` avec `{"state":"Toscane","latitude":"43,769","longitude":"11.2558","descriptionEn":"…"}` | **200** ; base : `state='Toscane'`, `latitude='43.76900000'`, `longitude='11.25580000'`, `description_en` renseignée |
| Rechargement de l'éditeur | `value="Toscane"`, `value="43.769"`, `value="11.2558"` (affichage normalisé) et description EN restituée |
| Ménage | valeurs du seed restaurées (`state=null`, `latitude=48.8606`, `longitude=2.3376`, `description_en=null`) — vérifié en base |
