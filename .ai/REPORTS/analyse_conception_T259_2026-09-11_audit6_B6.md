# Analyse de conception — T-259 (audit n°6, B6)

- **Date** : 2026-09-11 · **Tâche courante** : T-259 · **Niveau** : S
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.6

## 1. Problème

Trois colonnes étaient **affichées** (adresse publique, description EN pour les visiteurs anglophones)
ou **lues** (`?near=`) sans qu'aucun écran ne permette de les renseigner, et les schémas d'API les
acceptaient sans borne :

| Champ | Avant | Conséquence mesurée |
|---|---|---|
| `descriptionEn` | absent des schémas create/update | `LocalizedDescription` retombait **toujours** sur le FR (0/8 renseigné en base) |
| `state` | accepté sans borne | 0/8 renseigné ; une saisie > 100 caractères finissait en **500** (colonne `varchar(100)`) |
| `latitude`/`longitude` | acceptés comme chaînes quelconques | 8/8 en base **par le seed seulement** : toute annonce créée par un hôte était ignorée par `near` |

## 2. Options

| Option | Verdict |
|---|---|
| Créer la description EN côté serveur par traduction automatique | **Écartée** : dépendance externe, coût, qualité non maîtrisée |
| Champs numériques `z.number()` pour les coordonnées | **Écartée** : les colonnes `decimal` sont rendues en **chaînes** par drizzle/pg ; passer en nombre romprait les échanges existants (seed, API publique) |
| Champs **optionnels** de type chaîne, validés et normalisés | **Retenue** : aucune rupture (PUT partiel), bornes réelles, virgule décimale tolérée, `""` ⇒ `null` |
| Ne rien faire et documenter l'abandon | **Écartée** : `near` et la description EN sont des fonctionnalités annoncées aux voyageurs |

## 3. Conception retenue

- **Un helper unique** (`src/lib/coordinates.ts`) pour les deux schémas **et** l'affichage :
  `coordinateField()` (zod : trim, borne, normalisation « 43,769 » → « 43.769 », vide → `null`) et
  `displayCoordinate()` (retire les zéros inutiles d'un `decimal(10,8)` : « 43.76900000 » → « 43.769 »).
- **API** : `descriptionEn` (≤ 4000), `state` (≤ 100), coordonnées bornées — **additif**, aucune
  migration, aucune route nouvelle, les écritures existantes restent valides (elles ne dépassent pas
  les bornes : 8/8 des coordonnées du seed sont dans l'intervalle).
- **UI** : onglet Informations → « Description (EN) » + phrase de repli (la description FR sert de
  repli, comportement déjà en place) ; carte Localisation → « Région / État » (éditeur **et**
  création) et « Latitude »/« Longitude » (`type="number"`, bornes HTML + validation serveur) avec un
  texte qui dit à quoi elles servent (« Autour de moi »).
- **Pas de géocodage** : l'hôte saisit, la plateforme n'invente pas de coordonnées (décision produit,
  cohérente avec l'absence de dépendance externe du dépôt).

## 4. Dette restante (assumée)

- Les coordonnées ne sont **pas** saisissables à la création (l'audit demandait l'éditeur) : une annonce
  toute neuve reste hors `near` jusqu'à sa première édition — le texte d'aide le dit côté éditeur.
- Aucune carte interactive n'est ajoutée ; la saisie reste manuelle (hors périmètre du lot B).
