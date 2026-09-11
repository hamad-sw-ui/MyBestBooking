# Analyse d'impact — T-259 (audit n°6, B6 : description EN, région, coordonnées)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking` · **BASE** : `76ec5b9`
- **Niveau déclaré pour la tâche courante** : **S** (trois colonnes existantes deviennent éditables ;
  aucune migration, aucun changement de schéma de base).
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.6 (B6)
- **Rapport de validation** : `.ai/REPORTS/validation_T259_2026-09-11_audit6_B6.md`

## 1. Surfaces touchées (mesuré)

```bash
grep -rn "descriptionEn" src/app/api/properties/route.ts "src/app/api/properties/[id]/route.ts"   # absent avant
grep -rn "latitude" src/app/dashboard/properties/new/page.tsx "src/app/dashboard/properties/[id]/property-edit-client.tsx"  # absent avant
grep -rn "state" src/lib/public-property.ts   # déjà projeté (affichage public), jamais alimenté par l'UI
```

| Fichier | Nature | Rôle |
|---|---|---|
| `src/lib/coordinates.ts` | **créé** | bornes (−90..90 / −180..180), virgule décimale, `"" ⇒ null`, affichage sans zéros inutiles |
| `src/app/api/properties/route.ts` | modifié | schéma POST : `descriptionEn`, `state` bornée à 100, coordonnées validées |
| `src/app/api/properties/[id]/route.ts` | modifié | schéma PUT : mêmes règles (le PUT est partiel et **spread** `...data`) |
| `src/app/dashboard/properties/[id]/property-edit-client.tsx` | modifié | 4 champs (interface, payload, saisie) |
| `src/app/dashboard/properties/[id]/page.tsx` | modifié | **transmet** les 4 colonnes à l'éditeur |
| `src/app/dashboard/properties/new/page.tsx` | modifié | région à la création (grille passée de 3 à 2 colonnes) |
| `src/lib/ui-strings.ts` (+ test) | modifié | +6 clés FR/EN, verrou 1742 → 1748 |

## 2. Appelants et effets indirects

1. **PUT `/api/properties/[id]`** : le handler fait `.set({ ...data, updatedAt })` — ajouter des champs au
   schéma les persiste sans autre modification. Les contrôles d'autorisation (hôte propriétaire,
   commission/labels/statut admin-only, gate d'approbation) sont **avant** l'écriture et ne changent pas.
2. **Projection publique** : `toPublicProperty()` portait déjà `state`/`latitude`/`longitude`/
   `descriptionEn` ; `LocalizedDescription` choisit la description EN quand elle existe. Le changement
   **alimente** ces affichages, il ne les modifie pas.
3. **`?near=`** (`api/properties/route.ts`) : la clause écarte les biens sans coordonnées. Une annonce
   éditée gagne en visibilité — aucun autre filtre n'est touché, et une annonce sans coordonnées garde
   exactement le comportement actuel.
4. **Éditeur** : le payload du PUT envoie désormais `state`, `latitude`, `longitude`, `descriptionEn`
   (chaîne vide comprise). C'est pourquoi la page `[id]` **doit** transmettre les colonnes : sans cela,
   l'éditeur aurait renvoyé des valeurs vides et **effacé** les coordonnées existantes (piège identifié
   et couvert par un test de restitution).

## 3. Risques de régression et traitement

| Risque | Traitement |
|---|---|
| Effacer des coordonnées existantes | La page `[id]` transmet les 4 colonnes ; test « efface / relit » + sonde runtime sur un bien du seed (coordonnées seed restaurées après la sonde) |
| Saisie hors bornes | 400 explicite (`Latitude invalide (−90 à 90)`), valeur refusée non écrite (test) |
| `state` trop longue (colonne `varchar(100)`) | `.max(100)` → 400 au lieu d'un 500 PostgreSQL |
| Descriptions EN volumineuses | `.max(4000)` (même borne que les descriptions existantes) |
| i18n | 6 clés FR **et** EN, verrou mis à jour dans le même commit (1742 → 1748) |

## 4. Revérification

`tsc` 0 · `eslint` 0/0 · `route.t259` 4/4 · `coordinates` 3/3 · `ui-strings` 7/7 · vitest complet
**142 fichiers / 796 tests, 0 échec** · sonde runtime : libellés présents dans l'éditeur, PUT avec
virgule décimale (« 43,769 ») → `43.76900000` persisté, relecture affichée « 43.769 », puis valeurs du
seed restaurées.
